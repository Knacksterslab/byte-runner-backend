import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class UpsertCampaignTargetingDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  threatIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kitTypes?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  countries?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  platforms?: string[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
