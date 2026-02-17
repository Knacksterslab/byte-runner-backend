import { config } from 'dotenv';
import https from 'https';

config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Extract project ref from URL (e.g., zskixrfsfqhszbstaeny from https://zskixrfsfqhszbstaeny.supabase.co)
const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];

if (!projectRef) {
  console.error('Could not extract project ref from SUPABASE_URL');
  process.exit(1);
}

const sql = `
-- Add fraud prevention fields
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_withdrawal_at timestamptz;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS fraud_score integer NOT NULL DEFAULT 0;

-- Create fraud flags table
CREATE TABLE IF NOT EXISTS public.fraud_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  flag_type text NOT NULL,
  severity integer NOT NULL DEFAULT 1,
  reference_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_flags_user_id_idx ON public.fraud_flags (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_severity_idx ON public.fraud_flags (severity DESC);
`;

console.log('\n🔧 Applying fraud prevention schema...\n');
console.log('ℹ️  Please run the following SQL in Supabase SQL Editor:\n');
console.log('📍 URL: https://supabase.com/dashboard/project/' + projectRef + '/sql\n');
console.log('--- SQL START ---');
console.log(sql);
console.log('--- SQL END ---\n');
console.log('Then re-run: npm run test:fraud\n');
