import { IsBoolean, IsOptional, IsString, IsUrl, IsUUID } from 'class-validator';

export class CreateCreativeDto {
  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsUrl({ require_tld: true })
  ctaUrl: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCreativeDto {
  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  logo?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  ctaLabel?: string;

  @IsOptional()
  @IsUrl({ require_tld: true })
  ctaUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
