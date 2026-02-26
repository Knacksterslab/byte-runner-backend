import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface ShareRecord {
  id: string;
  user_id: string;
  run_id: string | null;
  score: number | null;
  platform: string;
  created_at: string;
}

@Injectable()
export class SharesService {
  private readonly logger = new Logger(SharesService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get client() {
    return this.supabaseService.getClient();
  }

  async recordShare(userId: string, platform: string, score?: number, runId?: string): Promise<ShareRecord> {
    const { data: share, error } = await this.client
      .from('shares')
      .insert({ user_id: userId, run_id: runId ?? null, score: score ?? null, platform })
      .select('*')
      .single();

    if (error || !share) {
      throw new BadRequestException(error?.message ?? 'Failed to record share.');
    }

    await this.awardContinueToken(userId);
    return share as ShareRecord;
  }

  private async awardContinueToken(userId: string): Promise<void> {
    const { error } = await this.client.rpc('increment_continue_tokens', { user_id: userId });
    if (error) this.logger.error(`Failed to award continue token for user ${userId}:`, error);
  }

  async getUserShareCount(userId: string): Promise<number> {
    const { count, error } = await this.client
      .from('shares')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (error) throw new BadRequestException('Failed to get share count.');
    return count ?? 0;
  }
}
