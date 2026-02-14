import { IsString, IsDateString, IsOptional, IsObject, IsNumber, Matches } from 'class-validator';

export class CreateContestDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug must be lowercase alphanumeric with hyphens only' })
  slug?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  startDate: string;

  @IsDateString()
  endDate: string;

  @IsString()
  @IsOptional()
  contestTimezone?: string;

  @IsString()
  @IsOptional()
  status?: 'upcoming' | 'active' | 'ended' | 'cancelled';

  @IsObject()
  @IsOptional()
  prizePool?: Record<string, string>;

  @IsObject()
  @IsOptional()
  rules?: Record<string, any>;

  @IsNumber()
  @IsOptional()
  maxEntriesPerUser?: number;
}
