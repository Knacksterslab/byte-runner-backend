import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { getBestScorePerUser } from '../common/utils/scores.util';

export interface DailyModifiers {
  boostedThreats: string[];
  scarceKits: string[];
}

export interface DailyChallenge {
  id: string;
  challenge_date: string;
  name: string;
  description: string;
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
    return this.mapRow(data);
  }

  private mapRow(row: any): DailyChallenge {
    return {
      id: row.id,
      challenge_date: row.challenge_date,
      name: row.name,
      description: row.description,
      modifiers: row.modifiers ?? { boostedThreats: [], scarceKits: [] },
      status: row.status,
      winner_user_id: row.winner_user_id ?? null,
      winner_score: row.winner_score ?? null,
      created_at: row.created_at,
      ended_at: row.ended_at ?? null,
    };
  }

  async getLeaderboardForDate(dateKey: string, limit = 10): Promise<any[]> {
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    const { data, error } = await this.client
      .from('runs')
      .select('user_id, score, distance, created_at, users(username)')
      .gte('created_at', start)
      .lte('created_at', end)
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

  async getUserBestForDate(userId: string, dateKey: string): Promise<number | null> {
    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    const { data, error } = await this.client
      .from('runs')
      .select('score')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('score', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return data.score;
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

  /** Cron: close out yesterday — record its winner (no payout; badge-worthy). */
  async closeOutDay(dateKey: string): Promise<void> {
    const challenge = await this.getByDate(dateKey);
    if (!challenge || challenge.status !== 'active') return;

    const start = new Date(`${dateKey}T00:00:00.000Z`).toISOString();
    const end = new Date(`${dateKey}T23:59:59.999Z`).toISOString();
    const { data, error } = await this.client
      .from('runs')
      .select('id, user_id, score, distance')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('score', { ascending: false })
      .order('distance', { ascending: false })
      .limit(1)
      .maybeSingle();

    const winner = error ? null : data;
    const { error: updateError } = await this.client
      .from('daily_challenges')
      .update({
        status: 'ended',
        winner_user_id: winner?.user_id ?? null,
        winner_run_id: winner?.id ?? null,
        winner_score: winner?.score ?? null,
        ended_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    if (updateError) this.logger.error('Error closing daily challenge:', updateError);
  }
}
