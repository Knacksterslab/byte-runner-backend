import { IsString, IsDateString, IsOptional, IsObject, IsNumber } from 'class-validator';

export class CreateContestDto {
  @IsString()
  name: string;

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
