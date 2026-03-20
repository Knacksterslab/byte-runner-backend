import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sign, verify } from 'jsonwebtoken';
import { SupabaseService } from '../supabase/supabase.service';
import { assertNoDbError } from '../common/utils/db.util';

type SponsorStatus = 'active' | 'paused' | 'archived';
type CampaignStatus = 'draft' | 'active' | 'paused' | 'archived';
type AdEventType = 'impression' | 'click';

export interface SponsorRow {
  id: string;
  slug: string;
  name: string;
  legal_name?: string | null;
  status: SponsorStatus;
  allowed_domains?: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignRow {
  id: string;
  sponsor_id: string;
  name: string;
  status: CampaignStatus;
  starts_at: string;
  ends_at?: string | null;
  priority?: number | null;
  pacing_mode?: string | null;
  daily_budget_cents?: number | null;
  total_budget_cents?: number | null;
  daily_impression_cap?: number | null;
  total_impression_cap?: number | null;
  frequency_cap_per_user_per_day?: number | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  sponsors?: SponsorRow | SponsorRow[] | null;
  sponsor_creatives?: CreativeRow[] | null;
  campaign_targeting?: TargetingRow | TargetingRow[] | null;
}

export interface CreativeRow {
  id: string;
  campaign_id: string;
  tag?: string | null;
  logo?: string | null;
  title: string;
  description: string;
  cta_label?: string | null;
  cta_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TargetingRow {
  id?: string;
  campaign_id: string;
  threat_ids?: string[] | null;
  kit_types?: string[] | null;
  countries?: string[] | null;
  platforms?: string[] | null;
  metadata?: Record<string, unknown> | null;
}

export interface RecoverySponsor {
  id: string;
  campaignId: string;
  creativeId: string;
  tag?: string;
  logo?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaUrl?: string;
  clickUrl?: string;
  trackingToken: string;
}

export interface RecoverySponsorContext {
  userId?: string | null;
  sessionId?: string | null;
  country?: string | null;
  platform?: string | null;
}

interface TrackingTokenPayload {
  sponsorId: string;
  campaignId: string;
  creativeId: string;
  ctaUrl: string;
  iat?: number;
  exp?: number;
}

interface AdminCreateSponsorInput {
  slug: string;
  name: string;
  legalName?: string;
  status?: SponsorStatus;
  allowedDomains?: string[];
  metadata?: Record<string, unknown>;
}

interface AdminUpdateSponsorInput {
  slug?: string;
  name?: string;
  legalName?: string;
  status?: SponsorStatus;
  allowedDomains?: string[];
  metadata?: Record<string, unknown>;
}

interface AdminCreateCampaignInput {
  sponsorId: string;
  name: string;
  status?: CampaignStatus;
  startsAt: string;
  endsAt?: string | null;
  priority?: number;
  pacingMode?: 'balanced' | 'frontloaded';
  dailyBudgetCents?: number | null;
  totalBudgetCents?: number | null;
  dailyImpressionCap?: number | null;
  totalImpressionCap?: number | null;
  frequencyCapPerUserPerDay?: number;
  metadata?: Record<string, unknown>;
}

interface AdminUpdateCampaignInput extends Partial<AdminCreateCampaignInput> {}

interface AdminCreateCreativeInput {
  campaignId: string;
  tag?: string;
  logo?: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaUrl: string;
  isActive?: boolean;
}

interface AdminUpdateCreativeInput extends Partial<AdminCreateCreativeInput> {}

@Injectable()
export class SponsorsService {
  private readonly logger = new Logger(SponsorsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  private get adsEnabled(): boolean {
    return process.env.RECOVERY_SPONSORING_ENABLED !== 'false';
  }

  private get trackingSecret(): string {
    return (
      this.configService.get<string>('sponsors.trackingTokenSecret') ||
      this.configService.get<string>('runs.runTokenSecret') ||
      'local-sponsor-secret'
    );
  }

  private get trackingTtlSeconds(): number {
    return this.configService.get<number>('sponsors.trackingTokenTtlSeconds') ?? 7200;
  }

  private get apiBaseUrl(): string {
    return (
      this.configService.get<string>('app.apiDomain') ||
      process.env.API_DOMAIN ||
      'http://localhost:3000'
    ).replace(/\/+$/, '');
  }

  private normalizeList(values?: string[] | null): string[] {
    return (values ?? [])
      .map((v) => (v || '').trim().toLowerCase())
      .filter(Boolean);
  }

  private normalizeSingle(value?: string | null): string | null {
    const next = value?.trim().toLowerCase();
    return next ? next : null;
  }

  private getCampaignTargeting(campaign: CampaignRow): TargetingRow | null {
    if (!campaign.campaign_targeting) return null;
    if (Array.isArray(campaign.campaign_targeting)) return campaign.campaign_targeting[0] ?? null;
    return campaign.campaign_targeting;
  }

  private getCampaignSponsor(campaign: CampaignRow): SponsorRow | null {
    if (!campaign.sponsors) return null;
    if (Array.isArray(campaign.sponsors)) return campaign.sponsors[0] ?? null;
    return campaign.sponsors;
  }

  private isCampaignWindowActive(campaign: CampaignRow, now = Date.now()): boolean {
    const startsAt = new Date(campaign.starts_at).getTime();
    const endsAt = campaign.ends_at ? new Date(campaign.ends_at).getTime() : null;
    if (Number.isNaN(startsAt)) return false;
    if (startsAt > now) return false;
    if (endsAt !== null && !Number.isNaN(endsAt) && endsAt < now) return false;
    return true;
  }

  private validateOutgoingUrl(url: string, allowedDomains: string[] | null | undefined): boolean {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) return false;
      const hostname = parsed.hostname.toLowerCase();
      const allow = this.normalizeList(allowedDomains);
      if (allow.length === 0) return true;
      return allow.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
    } catch {
      return false;
    }
  }

  private signTrackingToken(payload: Omit<TrackingTokenPayload, 'iat' | 'exp'>): string {
    return sign(payload, this.trackingSecret, {
      algorithm: 'HS256',
      expiresIn: this.trackingTtlSeconds,
    });
  }

  decodeTrackingToken(token: string): TrackingTokenPayload {
    try {
      const payload = verify(token, this.trackingSecret) as TrackingTokenPayload;
      if (!payload?.campaignId || !payload?.creativeId || !payload?.sponsorId || !payload?.ctaUrl) {
        throw new Error('Malformed tracking token');
      }
      return payload;
    } catch {
      throw new BadRequestException('Invalid or expired tracking token');
    }
  }

  private targetingScore(
    campaign: CampaignRow,
    threatId?: string | null,
    kitType?: string | null,
    country?: string | null,
    platform?: string | null,
  ): number {
    const targeting = this.getCampaignTargeting(campaign);
    const threat = this.normalizeSingle(threatId);
    const kit = this.normalizeSingle(kitType);
    const c = this.normalizeSingle(country);
    const p = this.normalizeSingle(platform);
    const threatList = this.normalizeList(targeting?.threat_ids);
    const kitList = this.normalizeList(targeting?.kit_types);
    const countryList = this.normalizeList(targeting?.countries);
    const platformList = this.normalizeList(targeting?.platforms);

    if (threatList.length > 0 && (!threat || !threatList.includes(threat))) return 0;
    if (kitList.length > 0 && (!kit || !kitList.includes(kit))) return 0;
    if (countryList.length > 0 && (!c || !countryList.includes(c))) return 0;
    if (platformList.length > 0 && (!p || !platformList.includes(p))) return 0;

    let rank = 0;
    if (kit && kitList.includes(kit)) rank += 2;
    if (threat && threatList.includes(threat)) rank += 1;
    rank += (campaign.priority ?? 0) * 0.01;
    if (!threatList.length && !kitList.length) rank += 0.1;
    return rank;
  }

  private async getCampaignEventCount(campaignId: string, eventType: AdEventType, since?: Date): Promise<number> {
    let query = this.client
      .from('ad_events')
      .select('id', { head: true, count: 'exact' })
      .eq('campaign_id', campaignId)
      .eq('event_type', eventType);
    if (since) query = query.gte('occurred_at', since.toISOString());
    const { count, error } = await query;
    assertNoDbError(error);
    return count ?? 0;
  }

  private async getUserDailyImpressions(
    campaignId: string,
    userId: string,
    eventType: AdEventType,
    since: Date,
  ): Promise<number> {
    const { count, error } = await this.client
      .from('ad_events')
      .select('id', { head: true, count: 'exact' })
      .eq('campaign_id', campaignId)
      .eq('event_type', eventType)
      .eq('user_id', userId)
      .gte('occurred_at', since.toISOString());
    assertNoDbError(error);
    return count ?? 0;
  }

  private async isCampaignCapped(campaign: CampaignRow, userId?: string | null): Promise<boolean> {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);

    if (campaign.total_impression_cap != null) {
      const total = await this.getCampaignEventCount(campaign.id, 'impression');
      if (total >= campaign.total_impression_cap) return true;
    }
    if (campaign.daily_impression_cap != null) {
      const daily = await this.getCampaignEventCount(campaign.id, 'impression', dayStart);
      if (daily >= campaign.daily_impression_cap) return true;
    }
    if (campaign.frequency_cap_per_user_per_day != null && campaign.frequency_cap_per_user_per_day >= 0 && userId) {
      const perUser = await this.getUserDailyImpressions(campaign.id, userId, 'impression', dayStart);
      if (perUser >= campaign.frequency_cap_per_user_per_day) return true;
    }
    return false;
  }

  async getRecoverySponsor(
    threatId?: string,
    kitType?: string,
    context: RecoverySponsorContext = {},
  ): Promise<RecoverySponsor | null> {
    const startedAt = Date.now();
    if (!this.adsEnabled) return null;

    const { data, error } = await this.client
      .from('sponsor_campaigns')
      .select(
        `
          id,
          sponsor_id,
          name,
          status,
          starts_at,
          ends_at,
          priority,
          created_at,
          updated_at,
          daily_impression_cap,
          total_impression_cap,
          frequency_cap_per_user_per_day,
          sponsors!inner(
            id,
            slug,
            name,
            status,
            allowed_domains
          ),
          sponsor_creatives(
            id,
            campaign_id,
            tag,
            logo,
            title,
            description,
            cta_label,
            cta_url,
            is_active
          ),
          campaign_targeting(
            campaign_id,
            threat_ids,
            kit_types,
            countries,
            platforms
          )
        `,
      )
      .eq('status', 'active');
    assertNoDbError(error);

    const nowMs = Date.now();
    const candidates = (data ?? [])
      .map((item) => item as CampaignRow)
      .filter((campaign) => this.getCampaignSponsor(campaign)?.status === 'active')
      .filter((campaign) => this.isCampaignWindowActive(campaign, nowMs))
      .map((campaign) => {
        const creatives = (campaign.sponsor_creatives ?? []).filter((creative) => creative.is_active);
        if (creatives.length === 0) return null;
        const topCreative = creatives[Math.floor(Math.random() * creatives.length)];
        const score = this.targetingScore(
          campaign,
          threatId,
          kitType,
          context.country,
          context.platform,
        );
        return { campaign, creative: topCreative, score };
      })
      .filter((entry): entry is { campaign: CampaignRow; creative: CreativeRow; score: number } => Boolean(entry))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    if (candidates.length === 0) {
      this.logger.debug(`sponsors.no_fill reason=no_candidates threat=${threatId ?? ''} kit=${kitType ?? ''}`);
      return null;
    }

    const bestScore = candidates[0].score;
    const tied = candidates.filter((entry) => Math.abs(entry.score - bestScore) < 0.0001);

    for (const candidate of tied) {
      const capped = await this.isCampaignCapped(candidate.campaign, context.userId ?? null);
      if (capped) continue;
      const sponsor = this.getCampaignSponsor(candidate.campaign);
      if (!this.validateOutgoingUrl(candidate.creative.cta_url, sponsor?.allowed_domains)) {
        this.logger.warn(`Skipping creative ${candidate.creative.id}: invalid or disallowed CTA URL.`);
        continue;
      }
      const trackingToken = this.signTrackingToken({
        sponsorId: candidate.campaign.sponsor_id,
        campaignId: candidate.campaign.id,
        creativeId: candidate.creative.id,
        ctaUrl: candidate.creative.cta_url,
      });
      this.logger.debug(
        `sponsors.fill campaign=${candidate.campaign.id} creative=${candidate.creative.id} latency_ms=${Date.now() - startedAt}`,
      );
      return {
        id: candidate.campaign.sponsor_id,
        campaignId: candidate.campaign.id,
        creativeId: candidate.creative.id,
        tag: candidate.creative.tag ?? 'SPONSORED',
        logo: candidate.creative.logo ?? undefined,
        title: candidate.creative.title,
        description: candidate.creative.description,
        ctaLabel: candidate.creative.cta_label ?? 'LEARN MORE',
        ctaUrl: candidate.creative.cta_url,
        clickUrl: `${this.apiBaseUrl}/sponsors/click/${encodeURIComponent(trackingToken)}`,
        trackingToken,
      };
    }

    this.logger.debug(`sponsors.no_fill reason=capped_or_invalid_url threat=${threatId ?? ''} kit=${kitType ?? ''}`);
    this.logger.debug(`sponsors.selection_latency_ms=${Date.now() - startedAt}`);
    return null;
  }

  async recordAdEvent(args: {
    trackingToken: string;
    eventType: AdEventType;
    userId?: string | null;
    sessionId?: string | null;
    threatId?: string | null;
    kitType?: string | null;
    idempotencyKey?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<{ recorded: boolean; duplicated: boolean; ctaUrl: string }> {
    const payload = this.decodeTrackingToken(args.trackingToken);

    const insert = {
      sponsor_id: payload.sponsorId,
      campaign_id: payload.campaignId,
      creative_id: payload.creativeId,
      user_id: args.userId ?? null,
      event_type: args.eventType,
      idempotency_key: args.idempotencyKey ?? null,
      session_id: args.sessionId ?? null,
      threat_id: this.normalizeSingle(args.threatId) ?? null,
      kit_type: this.normalizeSingle(args.kitType) ?? null,
      metadata: args.metadata ?? {},
      occurred_at: new Date().toISOString(),
    };

    const { error } = await this.client.from('ad_events').insert(insert);
    if (error?.code === '23505' && args.idempotencyKey) {
      return { recorded: false, duplicated: true, ctaUrl: payload.ctaUrl };
    }
    assertNoDbError(error);
    return { recorded: true, duplicated: false, ctaUrl: payload.ctaUrl };
  }

  async listSponsors(): Promise<SponsorRow[]> {
    const { data, error } = await this.client
      .from('sponsors')
      .select('*')
      .order('created_at', { ascending: false });
    assertNoDbError(error);
    return (data ?? []) as SponsorRow[];
  }

  async createSponsor(input: AdminCreateSponsorInput): Promise<SponsorRow> {
    const { data, error } = await this.client
      .from('sponsors')
      .insert({
        slug: input.slug.trim().toLowerCase(),
        name: input.name.trim(),
        legal_name: input.legalName?.trim() || null,
        status: input.status ?? 'active',
        allowed_domains: this.normalizeList(input.allowedDomains),
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    assertNoDbError(error);
    return data as SponsorRow;
  }

  async updateSponsor(id: string, input: AdminUpdateSponsorInput): Promise<SponsorRow> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.slug !== undefined) patch.slug = input.slug.trim().toLowerCase();
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.legalName !== undefined) patch.legal_name = input.legalName.trim();
    if (input.status !== undefined) patch.status = input.status;
    if (input.allowedDomains !== undefined) patch.allowed_domains = this.normalizeList(input.allowedDomains);
    if (input.metadata !== undefined) patch.metadata = input.metadata;
    const { data, error } = await this.client
      .from('sponsors')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    assertNoDbError(error);
    return data as SponsorRow;
  }

  async listCampaigns(): Promise<CampaignRow[]> {
    const { data, error } = await this.client
      .from('sponsor_campaigns')
      .select('*, sponsors(*), campaign_targeting(*), sponsor_creatives(*)')
      .order('created_at', { ascending: false });
    assertNoDbError(error);
    return (data ?? []) as CampaignRow[];
  }

  async createCampaign(input: AdminCreateCampaignInput): Promise<CampaignRow> {
    const { data, error } = await this.client
      .from('sponsor_campaigns')
      .insert({
        sponsor_id: input.sponsorId,
        name: input.name.trim(),
        status: input.status ?? 'draft',
        starts_at: input.startsAt,
        ends_at: input.endsAt ?? null,
        priority: input.priority ?? 0,
        pacing_mode: input.pacingMode ?? 'balanced',
        daily_budget_cents: input.dailyBudgetCents ?? null,
        total_budget_cents: input.totalBudgetCents ?? null,
        daily_impression_cap: input.dailyImpressionCap ?? null,
        total_impression_cap: input.totalImpressionCap ?? null,
        frequency_cap_per_user_per_day: input.frequencyCapPerUserPerDay ?? 5,
        metadata: input.metadata ?? {},
      })
      .select('*')
      .single();
    assertNoDbError(error);
    return data as CampaignRow;
  }

  async updateCampaign(id: string, input: AdminUpdateCampaignInput): Promise<CampaignRow> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.sponsorId !== undefined) patch.sponsor_id = input.sponsorId;
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.status !== undefined) patch.status = input.status;
    if (input.startsAt !== undefined) patch.starts_at = input.startsAt;
    if (input.endsAt !== undefined) patch.ends_at = input.endsAt;
    if (input.priority !== undefined) patch.priority = input.priority;
    if (input.pacingMode !== undefined) patch.pacing_mode = input.pacingMode;
    if (input.dailyBudgetCents !== undefined) patch.daily_budget_cents = input.dailyBudgetCents;
    if (input.totalBudgetCents !== undefined) patch.total_budget_cents = input.totalBudgetCents;
    if (input.dailyImpressionCap !== undefined) patch.daily_impression_cap = input.dailyImpressionCap;
    if (input.totalImpressionCap !== undefined) patch.total_impression_cap = input.totalImpressionCap;
    if (input.frequencyCapPerUserPerDay !== undefined) {
      patch.frequency_cap_per_user_per_day = input.frequencyCapPerUserPerDay;
    }
    if (input.metadata !== undefined) patch.metadata = input.metadata;
    const { data, error } = await this.client
      .from('sponsor_campaigns')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    assertNoDbError(error);
    return data as CampaignRow;
  }

  async setCampaignStatus(id: string, status: CampaignStatus): Promise<CampaignRow> {
    return this.updateCampaign(id, { status });
  }

  async createCreative(input: AdminCreateCreativeInput): Promise<CreativeRow> {
    const { data, error } = await this.client
      .from('sponsor_creatives')
      .insert({
        campaign_id: input.campaignId,
        tag: input.tag ?? null,
        logo: input.logo ?? null,
        title: input.title.trim(),
        description: input.description.trim(),
        cta_label: input.ctaLabel ?? null,
        cta_url: input.ctaUrl.trim(),
        is_active: input.isActive ?? true,
      })
      .select('*')
      .single();
    assertNoDbError(error);
    return data as CreativeRow;
  }

  async updateCreative(id: string, input: AdminUpdateCreativeInput): Promise<CreativeRow> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.campaignId !== undefined) patch.campaign_id = input.campaignId;
    if (input.tag !== undefined) patch.tag = input.tag;
    if (input.logo !== undefined) patch.logo = input.logo;
    if (input.title !== undefined) patch.title = input.title.trim();
    if (input.description !== undefined) patch.description = input.description.trim();
    if (input.ctaLabel !== undefined) patch.cta_label = input.ctaLabel;
    if (input.ctaUrl !== undefined) patch.cta_url = input.ctaUrl.trim();
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    const { data, error } = await this.client
      .from('sponsor_creatives')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();
    assertNoDbError(error);
    return data as CreativeRow;
  }

  async upsertCampaignTargeting(campaignId: string, targeting: Omit<TargetingRow, 'campaign_id' | 'id'>): Promise<TargetingRow> {
    const { data, error } = await this.client
      .from('campaign_targeting')
      .upsert(
        {
          campaign_id: campaignId,
          threat_ids: this.normalizeList(targeting.threat_ids),
          kit_types: this.normalizeList(targeting.kit_types),
          countries: this.normalizeList(targeting.countries),
          platforms: this.normalizeList(targeting.platforms),
          metadata: targeting.metadata ?? {},
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'campaign_id' },
      )
      .select('*')
      .single();
    assertNoDbError(error);
    return data as TargetingRow;
  }

  async simulateSelection(threatId?: string, kitType?: string) {
    const sponsor = await this.getRecoverySponsor(threatId, kitType, {});
    return { sponsor };
  }
}
