# Apply Fraud Prevention Schema

## Quick Start

You need to add 3 new database objects:

1. **Column**: `last_withdrawal_at` on `users` table
2. **Column**: `fraud_score` on `withdrawals` table  
3. **Table**: `fraud_flags` for tracking suspicious activity

## Option 1: Supabase Dashboard (Recommended)

1. Open your Supabase project: https://zskixrfsfqhszbstaeny.supabase.co
2. Go to **SQL Editor**
3. Copy and paste the SQL below:

```sql
-- Add fraud prevention fields to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_withdrawal_at timestamptz;

-- Add fraud score to withdrawals  
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fraud_score integer NOT NULL DEFAULT 0;

-- Create fraud flags table for tracking suspicious activity
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
```

4. Click **Run** or press `Cmd/Ctrl + Enter`
5. You should see: **Success. No rows returned**

## Option 2: CLI (If you have Supabase CLI installed)

```bash
supabase db push
```

## Verify It Worked

Run this SQL query to check:

```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'last_withdrawal_at';

SELECT table_name FROM information_schema.tables 
WHERE table_name = 'fraud_flags';
```

You should see both results returned.

## Then Re-run Tests

After applying the schema:

```bash
npm run test:fraud
```

Expected result: **19/19 tests pass (100%)**
