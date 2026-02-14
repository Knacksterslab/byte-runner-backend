create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  supertokens_id text not null unique,
  email text,
  username text,
  continue_tokens integer not null default 0,
  featured_badge text,
  created_at timestamptz not null default now()
);

create unique index if not exists users_username_unique
  on public.users (lower(username))
  where username is not null;

create unique index if not exists users_email_unique
  on public.users (lower(email))
  where email is not null;

create table if not exists public.runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  score integer not null,
  distance integer not null,
  duration_ms integer not null,
  client_version text,
  created_at timestamptz not null default now()
);

create index if not exists runs_created_at_idx on public.runs (created_at desc);
create index if not exists runs_score_idx on public.runs (score desc);

create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid references public.runs(id) on delete set null,
  score integer,
  platform text not null default 'twitter',
  created_at timestamptz not null default now()
);

create index if not exists shares_user_id_idx on public.shares (user_id);
create index if not exists shares_created_at_idx on public.shares (created_at desc);

-- Contests system
create table if not exists public.contests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  start_date timestamptz not null,
  end_date timestamptz not null,
  contest_timezone text not null default 'UTC',
  status text not null default 'upcoming',
  prize_pool jsonb,
  rules jsonb,
  max_entries_per_user integer default 999,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.contests
  add column if not exists contest_timezone text not null default 'UTC';

-- Add slug column for friendly URLs
alter table public.contests
  add column if not exists slug text;

-- Function to generate slug from contest name
create or replace function generate_contest_slug(contest_name text)
returns text as $$
begin
  return lower(
    regexp_replace(
      regexp_replace(contest_name, '[^a-zA-Z0-9\s-]', '', 'g'),
      '\s+', '-', 'g'
    )
  );
end;
$$ language plpgsql immutable;

-- Backfill existing contests with slugs (safe for re-run)
update public.contests
set slug = generate_contest_slug(name)
where slug is null;

-- Make slug required and unique
alter table public.contests
  alter column slug set not null;

create unique index if not exists contests_slug_idx on public.contests (slug);

create index if not exists contests_status_idx on public.contests (status);
create index if not exists contests_dates_idx on public.contests (start_date, end_date);

create table if not exists public.contest_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  run_id uuid not null references public.runs(id) on delete cascade,
  score integer not null,
  distance integer not null,
  rank integer,
  created_at timestamptz not null default now()
);

create unique index if not exists contest_entries_unique_run 
  on public.contest_entries (contest_id, run_id);
create index if not exists contest_entries_contest_id_idx 
  on public.contest_entries (contest_id);
create index if not exists contest_entries_score_idx 
  on public.contest_entries (contest_id, score desc, distance desc);
create index if not exists contest_entries_user_id_idx 
  on public.contest_entries (user_id);

create table if not exists public.prize_claims (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references public.contests(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  rank integer not null,
  prize_description text not null,
  claim_status text not null default 'pending',
  contact_info jsonb,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists prize_claims_status_idx on public.prize_claims (claim_status);
create index if not exists prize_claims_contest_id_idx on public.prize_claims (contest_id);
create index if not exists prize_claims_user_id_idx on public.prize_claims (user_id);

-- Badge system
create table if not exists public.badges (
  id text primary key,
  name text not null,
  description text not null,
  emoji text not null,
  category text not null,
  tier text not null default 'bronze',
  requirement_type text not null,
  requirement_value integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public.user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_id text not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique(user_id, badge_id)
);

create index if not exists user_badges_user_id_idx on public.user_badges (user_id);
create index if not exists user_badges_badge_id_idx on public.user_badges (badge_id);

-- Function to increment continue tokens
create or replace function increment_continue_tokens(user_id uuid)
returns void as $$
begin
  update public.users
  set continue_tokens = continue_tokens + 1
  where id = user_id;
end;
$$ language plpgsql;
