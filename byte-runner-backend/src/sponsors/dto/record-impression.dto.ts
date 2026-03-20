import { IsObject, IsOptional, IsString, Matches } from 'class-validator';

export class RecordImpressionDto {
  @IsString()
  trackingToken: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i, { message: 'threatId must be alphanumeric with hyphens' })
  threatId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i, { message: 'kitType must be alphanumeric with hyphens' })
  kitType?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
