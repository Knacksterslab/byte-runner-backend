import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { UserRecord } from '../users/users.service';
import * as jwt from 'jsonwebtoken';
import { FinishDrillDto } from './dto/finish-drill.dto';

interface DrillTokenPayload {
  sub: string;
  startedAt: number;
}

export interface TopicMastery {
  topic: string;
  taughtCount: number;
  testedCount: number;
  passedCount: number;
  failedCount: number;
  needsRemediation: boolean;
  lastPassedAt: string | null;
}

@Injectable()
export class DrillsService {
  private readonly logger = new Logger(DrillsService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  /** Mint a drill token bound to the user (run-token pattern). */
  startDrill(userId: string): { drillToken: string } {
    const secret = this.configService.get<string>('runs.runTokenSecret') ?? '';
    const drillToken = jwt.sign({ sub: userId, startedAt: Date.now() }, secret, {
      expiresIn: '1h',
    });
    return { drillToken };
  }

  /**
   * Record a verified learning outcome and update the mastery ledger.
   * This is the gate everything earns against — never trust clients.
   */
  async finishDrill(supertokensId: string, user: UserRecord, dto: FinishDrillDto) {
    let payload: DrillTokenPayload;
    try {
      payload = jwt.verify(dto.drillToken, this.configService.get<string>('runs.runTokenSecret') ?? '') as DrillTokenPayload;
    } catch {
      throw new BadRequestException('Invalid drill token.');
    }
    if (payload.sub !== supertokensId) throw new BadRequestException('Drill token does not match user.');

    const topic = dto.topic.trim().slice(0, 64);
    if (!topic) throw new BadRequestException('Topic is required.');

    const serverDurationMs = Math.max(0, Date.now() - payload.startedAt);
    const durationMs = Math.min(Math.max(dto.durationMs ?? serverDurationMs, 0), 3_600_000);
    const day = new Date().toISOString().slice(0, 10);

    const { error: insertError } = await this.supabase.getClient()
      .from('drill_results')
      .insert({
        user_id: user.id,
        day,
        kind: 'quiz',
        topic,
        format: (dto.format ?? 'quiz').slice(0, 32),
        passed: dto.passed,
        score: dto.score ?? 0,
        duration_ms: durationMs,
        question_id: dto.questionId ?? null,
      });
    if (insertError) {
      this.logger.error('Failed to insert drill result:', insertError);
      throw new BadRequestException('Failed to record drill result.');
    }

    const mastery = await this.upsertMastery(user.id, topic, dto.passed);
    return { topic, mastery };
  }

  private async upsertMastery(userId: string, topic: string, passed: boolean): Promise<TopicMastery> {
    const client = this.supabase.getClient();
    const { data: existing, error: selError } = await client
      .from('topic_mastery')
      .select('*')
      .eq('user_id', userId)
      .eq('topic', topic)
      .maybeSingle();
    if (selError) this.logger.error('Mastery select failed:', selError);

    const prev = existing ?? {
      taught_count: 0, tested_count: 0, passed_count: 0, failed_count: 0,
    };
    const next = {
      user_id: userId,
      topic,
      taught_count: (prev.taught_count ?? 0) + 1,
      tested_count: (prev.tested_count ?? 0) + 1,
      passed_count: (prev.passed_count ?? 0) + (passed ? 1 : 0),
      failed_count: (prev.failed_count ?? 0) + (passed ? 0 : 1),
      needs_remediation: !passed,
      last_passed_at: passed ? new Date().toISOString() : (existing?.last_passed_at ?? null),
      updated_at: new Date().toISOString(),
    };

    const { error } = await client.from('topic_mastery').upsert(next, {
      onConflict: 'user_id,topic',
    });
    if (error) this.logger.error('Mastery upsert failed:', error);

    return {
      topic,
      taughtCount: next.taught_count,
      testedCount: next.tested_count,
      passedCount: next.passed_count,
      failedCount: next.failed_count,
      needsRemediation: next.needs_remediation,
      lastPassedAt: next.last_passed_at,
    };
  }

  async getMastery(userId: string): Promise<TopicMastery[]> {
    const { data, error } = await this.supabase.getClient()
      .from('topic_mastery')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error) {
      this.logger.error('Mastery fetch failed:', error);
      return [];
    }
    return (data ?? []).map((row: any) => ({
      topic: row.topic,
      taughtCount: row.taught_count,
      testedCount: row.tested_count,
      passedCount: row.passed_count,
      failedCount: row.failed_count,
      needsRemediation: row.needs_remediation,
      lastPassedAt: row.last_passed_at ?? null,
    }));
  }
}
