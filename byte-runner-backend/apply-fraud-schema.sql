-- Apply fraud prevention schema updates
-- Run this after the main schema.sql

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
  flag_type text NOT NULL, -- 'multiple_wins', 'rapid_withdrawal', 'pattern_match', 'new_account', 'same_ip'
  severity integer NOT NULL DEFAULT 1, -- 1-10
  reference_id uuid, -- hourly_challenge_id, withdrawal_id, etc.
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fraud_flags_user_id_idx ON public.fraud_flags (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fraud_flags_severity_idx ON public.fraud_flags (severity DESC);
