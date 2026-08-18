import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class FinishDrillDto {
  /** JWT from POST /drills/start (same pattern as run tokens). */
  @IsString()
  drillToken: string;

  /** Threat category / topic this drill taught (open vocabulary, ≤64 chars). */
  @IsString()
  topic: string;

  /** 'quiz' today; remediation formats later (typing, pattern, ...). */
  @IsOptional()
  @IsString()
  format?: string;

  @IsBoolean()
  passed: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsString()
  questionId?: string;
}
