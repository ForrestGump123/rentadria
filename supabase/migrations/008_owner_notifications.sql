-- Owner internal notifications (server-only, via Supabase service role).
-- Used for plan/package changes and other system announcements.

create table if not exists public.rentadria_owner_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null default 'system',
  title text not null default '',
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists rentadria_owner_notifications_user_created_idx
  on public.rentadria_owner_notifications (user_id, created_at desc);

alter table public.rentadria_owner_notifications enable row level security;

comment on table public.rentadria_owner_notifications is 'Owner notifications; access only via server service role';

