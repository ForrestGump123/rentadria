create table if not exists public.rentadria_owner_notification_prefs (
  user_id text primary key,
  receive_enabled boolean not null default true,
  email_channel boolean not null default true,
  dashboard_channel boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.rentadria_owner_notification_prefs enable row level security;

