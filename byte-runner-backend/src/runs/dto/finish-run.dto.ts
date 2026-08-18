import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FinishRunDto {
  @IsString()
  runToken: string;

  @IsInt()
  @Min(0)
  score: number;

  @IsInt()
  @Min(0)
  distance: number;

  @IsInt()
  @Min(0)
  durationMs: number;

  @IsOptional()
  @IsString()
  clientVersion?: string;
}
