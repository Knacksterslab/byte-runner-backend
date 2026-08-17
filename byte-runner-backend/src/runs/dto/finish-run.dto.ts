import { IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

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

  /** Game format: 'runner' (default) or 'phishkit'. */
  @IsOptional()
  @IsString()
  mechanic?: string;

  /** Phish Kit: the composed lure's part IDs — the server scores from these. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  parts?: string[];
}
