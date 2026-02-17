-- Create a test hourly challenge for the current hour
-- This allows you to see the hourly challenge banner immediately without waiting for the cron

-- Get the current hour (rounded down to :00)
INSERT INTO public.hourly_challenges (
  challenge_hour,
  status
) VALUES (
  date_trunc('hour', NOW()),
  'active'
)
ON CONFLICT (challenge_hour) DO NOTHING;

-- Verify the challenge was created
SELECT * FROM public.hourly_challenges 
WHERE challenge_hour = date_trunc('hour', NOW());
