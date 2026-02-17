import { Module } from '@nestjs/common';
import { FraudPreventionService } from './fraud-prevention.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  providers: [FraudPreventionService],
  exports: [FraudPreventionService]
})
export class FraudPreventionModule {}
