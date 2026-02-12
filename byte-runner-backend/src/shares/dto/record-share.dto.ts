import { IsString, IsOptional, IsNumber } from 'class-validator';

export class RecordShareDto {
  @IsString()
  platform: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  runId?: string;
}
