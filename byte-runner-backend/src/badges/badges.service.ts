import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Badge {
  id: string;
  name: string;
  description: string;
  emoji: string;
  category: 'achievement' | 'social' | 'contest' | 'skill';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  requirement_type: 'score' | 'shares' | 'runs' | 'contest_wins' | 'special';
  requirement_value: number;
  created_at: string;
}

export interface UserBadge {
  id: string;
  user_id: string;
  badge_id: string;
  earned_at: string;
}

@Injectable()
export class BadgesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async getAllBadges(): Promise<Badge[]> {
    const { data, error } = await this.client
      .from('badges')
      .select('*')
      .order('requirement_value', { ascending: true });

    if (error) throw new Error('Failed to fetch badges.');
    return (data || []) as Badge[];
  }

  async getUserBadges(userId: string): Promise<any[]> {
    const { data, error } = await this.client
      .from('user_badges')
      .select('*, badges(*)')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false });

    if (error) throw new Error('Failed to fetch user badges.');
    return data || [];
  }

  async awardBadge(userId: string, badgeId: string): Promise<UserBadge | null> {
    // Check if user already has this badge
    const { data: existing } = await this.client
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .single();

    if (existing) return null; // Already has badge

    const { data: badge, error } = await this.client
      .from('user_badges')
      .insert({ user_id: userId, badge_id: badgeId })
      .select('*')
      .single();

    if (error) throw new Error('Failed to award badge.');
    return badge as UserBadge;
  }

  async checkAndAwardBadges(userId: string): Promise<string[]> {
    const awardedBadges: string[] = [];

    // Get user stats
    const [shares, runs] = await Promise.all([
      this.getUserShareCount(userId),
      this.getUserRunCount(userId),
    ]);

    // Check social badges (shares)
    const shareBadges = [
      { id: 'advocate', requirement: 1 },
      { id: 'promoter', requirement: 5 },
      { id: 'influencer', requirement: 15 },
      { id: 'ambassador', requirement: 50 },
    ];

    for (const badge of shareBadges) {
      if (shares >= badge.requirement) {
        const awarded = await this.awardBadge(userId, badge.id);
        if (awarded) awardedBadges.push(badge.id);
      }
    }

    // Check skill badges (runs)
    const runBadges = [
      { id: 'newbie', requirement: 1 },
      { id: 'regular', requirement: 10 },
      { id: 'veteran', requirement: 50 },
      { id: 'legend', requirement: 100 },
    ];

    for (const badge of runBadges) {
      if (runs >= badge.requirement) {
        const awarded = await this.awardBadge(userId, badge.id);
        if (awarded) awardedBadges.push(badge.id);
      }
    }

    return awardedBadges;
  }

  private async getUserShareCount(userId: string): Promise<number> {
    const { count } = await this.client
      .from('shares')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return count || 0;
  }

  private async getUserRunCount(userId: string): Promise<number> {
    const { count } = await this.client
      .from('runs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    return count || 0;
  }

  async setFeaturedBadge(userId: string, badgeId: string): Promise<void> {
    // Verify user has this badge
    const { data: hasBadge } = await this.client
      .from('user_badges')
      .select('*')
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .single();

    if (!hasBadge) throw new Error('User does not have this badge.');

    await this.client
      .from('users')
      .update({ featured_badge: badgeId })
      .eq('id', userId);
  }
}
