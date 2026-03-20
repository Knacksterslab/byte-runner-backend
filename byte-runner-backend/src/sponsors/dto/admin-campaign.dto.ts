import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @IsUUID()
  sponsorId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'archived'])
  status?: 'draft' | 'active' | 'paused' | 'archived';

  @IsDateString()
  startsAt: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsIn(['balanced', 'frontloaded'])
  pacingMode?: 'balanced' | 'frontloaded';

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyBudgetCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalBudgetCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyImpressionCap?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalImpressionCap?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  frequencyCapPerUserPerDay?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateCampaignDto {
  @IsOptional()
  @IsUUID()
  sponsorId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['draft', 'active', 'paused', 'archived'])
  status?: 'draft' | 'active' | 'paused' | 'archived';

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string | null;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsIn(['balanced', 'frontloaded'])
  pacingMode?: 'balanced' | 'frontloaded';

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyBudgetCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalBudgetCents?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  dailyImpressionCap?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  totalImpressionCap?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  frequencyCapPerUserPerDay?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SetCampaignLifecycleDto {
  @IsIn(['draft', 'active', 'paused', 'archived'])
  status: 'draft' | 'active' | 'paused' | 'archived';
}
