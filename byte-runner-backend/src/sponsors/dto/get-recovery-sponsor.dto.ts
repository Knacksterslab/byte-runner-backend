import { IsOptional, IsString, Matches } from 'class-validator';

export class GetRecoverySponsorDto {
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i, { message: 'threatId must be alphanumeric with hyphens' })
  threatId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/i, { message: 'kitType must be alphanumeric with hyphens' })
  kitType?: string;
}
