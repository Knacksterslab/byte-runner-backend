import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getBestScorePerUser } from '../common/utils/scores.util';

export interface DailyModifiers {
  boostedThreats: string[];
  scarceKits: string[];
}

export interface DailyStagePlan {
  /** Level a zero-failure player should reach today (~3h path). */
  targetLevel: number;
  /** Topics today's path emphasizes (from the archetype's boosted threats). */
  focusTopics: string[];
  stages: { kind: string; label: string; minutes: number }[];
}

export interface DailyChallenge {
  id: string;
  challenge_date: string;
  name: string;
  description: string;
  stages: DailyStagePlan | null;
  /** Dormant format column (always 'runner' today) — kept for future formats. */
  mechanic: string;
  modifiers: DailyModifiers;
  status: string;
  winner_user_id: string | null;
  winner_score: number | null;
  created_at: string;
  ended_at: string | null;
}

interface IncidentArchetype {
  name: string;
  description: string;
  boostedThreats: string[];
  scarceKits: string[];
}

/** One archetype is picked deterministically per UTC day — everyone faces it. */
const INCIDENT_LIBRARY: IncidentArchetype[] = [
  {
    name: 'PHISHING FRENZY',
    description: 'Inbox avalanche: phishing and email-borne threats dominate the net. Watch every sender.',
    boostedThreats: ['phishing', 'email-security'],
    scarceKits: ['vpn-shield'],
  },
  {
    name: 'PASSWORD PANIC',
    description: 'Credential lists leaked overnight. Password and authentication attacks are everywhere.',
    boostedThreats: ['password', 'authentication'],
    scarceKits: ['patch-manager'],
  },
  {
    name: 'WIFI DEADZONE',
    description: 'Rogue hotspots everywhere. WiFi and remote-work threats hunt unencrypted traffic.',
    boostedThreats: ['wifi', 'remote-work'],
    scarceKits: ['link-analyzer'],
  },
  {
    name: 'DATA LEAK SPRING',
    description: 'Insiders and ransomware crews are exfiltrating. Guard your data-loss surfaces.',
    boostedThreats: ['data-loss', 'insider-threats'],
    scarceKits: ['mfa-authenticator'],
  },
  {
    name: 'SUPPLY CHAIN SHOCK',
    description: 'A vendor was compromised. Update channels and packages are weaponised today.',
    boostedThreats: ['supply-chain', 'updates'],
    scarceKits: ['backup-system'],
  },
  {
    name: 'SOCIAL STORM',
    description: 'Pretexters and meeting crashers are out in force. Trust nothing unverified.',
    boostedThreats: ['social-engineering', 'meeting-security'],
    scarceKits: ['password-manager'],
  },
  {
    name: 'MOBILE MELTDOWN',
    description: 'Stranded at the airport: removable media and travel threats rule the day.',
    boostedThreats: ['removable-media', 'travel-security'],
    scarceKits: ['privacy-optimizer'],
  },
];

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Deterministic daily curriculum plan: reach targetLevel N today.
 * Tunable: with quiz discounts the average player reaches ~L9 in ~2.5-3.5h.
 */
function stagePlanForDate(dateKey: string, boostedThreats: string[]): DailyStagePlan {
  const targetLevel = 8 + (hashString(dateKey + ':target') % 5); // 8..12
  const topics = boostedThreats.length > 0 ? boostedThreats : ['phishing'];
  return {
    targetLevel,
    focusTopics: topics,
    stages: [
      { kind: 'runner-leg', label: `Warm-up: reach level 3`, minutes: 20 },
      { kind: 'quiz-checkpoint', label: `Checkpoint quiz (level 3)`, minutes: 2 },
      { kind: 'runner-leg', label: `Push to level ${Math.min(6, targetLevel - 1)}`, minutes: 35 },
      { kind: 'quiz-checkpoint', label: `Checkpoint quiz (level 6)`, minutes: 2 },
      { kind: 'runner-leg', label: `The long leg: level ${targetLevel}`, minutes: 80 },
      { kind: 'drill', label: `Remediation drills (only if you fail a topic)`, minutes: 0 },
    ],
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

@Injectable()
export class DailyChallengesService {
  private readonly logger = new Logger(DailyChallengesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  private get client() {
    return this.supabase.getClient();
  }

  todayKey(): string {
    return utcDateKey();
  }

  endOfDayIso(): string {
    const key = this.todayKey();
    return new Date(`${key}T23:59:59.999Z`).toISOString();
  }

  archetypeForDate(dateKey: string): IncidentArchetype {
    return INCIDENT_LIBRARY[hashString(dateKey) % INCIDENT_LIBRARY.length]!;
  }

  async getOrCreateChallengeByDate(dateKey: string): Promise<DailyChallenge | null> {
    const existing = await this.getByDate(dateKey);
    if (existing) return existing;

    const archetype = this.archetypeForDate(dateKey);
    const { data, error } = await this.client
      .from('daily_challenges')
      .insert({
        challenge_date: dateKey,
        name: archetype.name,
        description: archetype.description,
        stages: stagePlanForDate(dateKey, archetype.boostedThreats),
        modifiers: {
          boostedThreats: archetype.boostedThreats,
          scarceKits: archetype.scarceKits,
        },
        status: 'active',
      })
      .select()
      .single();

    if (error && error.code !== '23505') {
      // 23505 = unique violation: another worker created it first — re-read.
      this.logger.error('Error creating daily challenge:', error);
      return this.getByDate(dateKey);
    }
    if (error) return this.getByDate(dateKey);
    return this.mapRow(data);
  }

  async getByDate(dateKey: string): Promise<DailyChallenge | null> {
    const { data, error } = await this.client
      .from('daily_challenges')
      .select('*')
      .eq('challenge_date', dateKey)
      .maybeSingle();
    if (error || !data) return null;
    const row = this.mapRow(data);
    // Rows created before the scheduler shipped have no stages — compute the
    // deterministic plan on read so today's card works without a backfill.
    if (!row.stages) {
      const archetype = this.archetypeForDate(dateKey);
      row.stages = stagePlanForDate(dateKey, archetype.boostedThreats);
    }
    return row;
  }

  private mapRow(row: any): DailyChallenge {
    return {
      id: row.id,
      challenge_date: row.challenge_date,
      name: row.name,
      description: row.description,
      stages: (row.stages as DailyStagePlan) ?? null,
      mechanic: row.mechanic ?? 'runner',
      modifiers: row.modifiers ?? { boostedThreats: [], scarceKits: [] },
      status: row.status,
      winner_user_id: row.winner_user_id ?? null,
      winner_score: row.winner_score ?? null,
      created_at: row.created_at,
      ended_at: row.ended_at ?? null,
    };
  }

  async getLeaderboardForDate(dateKey: string, limit = 10, mechanic?: string): Promise<any[]> {
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    let query = this.client
      .from('runs')
      .select('user_id, score, distance, created_at, users(username)')
      .gte('created_at', start)
      .lte('created_at', end)
    if (mechanic) query = query.eq('mechanic', mechanic)
    const { data, error } = await query
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(200);

    if (error) {
      this.logger.error('Error fetching daily leaderboard:', error);
      return [];
    }
    const best = getBestScorePerUser(data ?? []);
    return Array.from(best.values())
      .slice(0, limit)
      .map((entry: any, index) => ({
        rank: index + 1,
        userId: entry.user_id,
        username: entry.users?.username ?? 'Anonymous',
        score: entry.score,
        distance: entry.distance,
        createdAt: entry.created_at,
      }));
  }

  async getUserBestForDate(userId: string, dateKey: string, mechanic?: string): Promise<number | null> {
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    let query = this.client
      .from('runs')
      .select('score')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
    if (mechanic) query = query.eq('mechanic', mechanic)
    const { data, error } = await query
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.score;
  }

  /** User's best level reached today — curriculum progress. */
  async getBestLevelToday(userId: string): Promise<number> {
    const dateKey = this.todayKey();
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    const { data, error } = await this.client
      .from('runs')
      .select('level')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('level', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return 0;
    return data.level ?? 0;
  }

  /** Consecutive UTC days (ending today or yesterday) on which the user has ≥1 run. */
  async getUserStreak(userId: string): Promise<number> {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
    const { data, error } = await this.client
      .from('runs')
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error || !data) return 0;

    const days = new Set(data.map((r: any) => utcDateKey(new Date(r.created_at))));
    const today = new Date();
    let streak = 0;
    if (!days.has(utcDateKey(today))) {
      today.setUTCDate(today.getUTCDate() - 1);
    }
    while (days.has(utcDateKey(today))) {
      streak++;
      today.setUTCDate(today.getUTCDate() - 1);
    }
    return streak;
  }

  /** Top N runs for a date (id/user/score/distance), best per user. */
  async getTopRunsForDate(dateKey: string, n = 3, mechanic?: string): Promise<any[]> {
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    let query = this.client
      .from('runs')
      .select('id, user_id, score, distance')
      .gte('created_at', start)
      .lte('created_at', end)
    if (mechanic) query = query.eq('mechanic', mechanic)
    const { data, error } = await query
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(200);
    if (error) {
      this.logger.error('Error fetching top daily runs:', error);
      return [];
    }
    const best = getBestScorePerUser(data ?? []);
    return Array.from(best.values()).slice(0, n);
  }

  /**
   * Cron: close out yesterday — award points to the top 3 (100/50/25, where
   * 1 point = 1 cent in the balance ledger) after fraud checks, and record
   * the winner. Ineligible players are skipped, not shifted up.
   */
  async closeOutDay(
    dateKey: string,
    awardPoints?: (userId: string, points: number, reason: string) => Promise<boolean>,
    isEligible?: (userId: string) => Promise<{ eligible: boolean; reason?: string }>,
  ): Promise<void> {
    const challenge = await this.getByDate(dateKey);
    if (!challenge || challenge.status !== 'active') return;

    const top = await this.getTopRunsForDate(dateKey, 3, challenge.mechanic);
    const tiers = [100, 50, 25];
    let anyPaid = false;
    let winner: any = null;

    for (let i = 0; i < top.length && i < tiers.length; i++) {
      const entry = top[i];
      if (!winner) winner = entry;
      if (!awardPoints || !isEligible) continue;
      const eligibility = await isEligible(entry.user_id);
      if (!eligibility.eligible) {
        this.logger.warn(`Daily rank ${i + 1} (${entry.user_id}) ineligible: ${eligibility.reason}`);
        continue;
      }
      const ok = await awardPoints(entry.user_id, tiers[i]!, `Daily Incident #${i + 1} — ${challenge.name} (${dateKey})`);
      if (ok) anyPaid = true;
    }

    const { error: updateError } = await this.client
      .from('daily_challenges')
      .update({
        status: anyPaid ? 'paid' : 'ended',
        winner_user_id: winner?.user_id ?? null,
        winner_run_id: winner?.id ?? null,
        winner_score: winner?.score ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    if (updateError) this.logger.error('Error closing daily challenge:', updateError);
  }
}
