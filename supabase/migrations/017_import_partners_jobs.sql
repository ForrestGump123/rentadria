-- Import partners + owner XML settings + sync jobs (Supabase backed, admin-only via service role).

create table if not exists public.rentadria_sync_partners (
  id uuid primary key,
  name text not null,
  base_url text not null,
  api_key text null,
  categories jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rentadria_import_owner_settings (
  owner_user_id text primary key,
  feed_url text null,
  field_mapping jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.rentadria_sync_jobs (
  id uuid primary key,
  at timestamptz not null default now(),
  scope text not null,
  status text not null,
  message text not null,
  owner_user_id text null,
  partner_id uuid null references public.rentadria_sync_partners (id) on delete set null,
  categories jsonb not null default '[]'::jsonb
);

create unique index if not exists rentadria_sync_partners_name_uq
  on public.rentadria_sync_partners (lower(trim(name)));

alter table public.rentadria_sync_partners enable row level security;
alter table public.rentadria_import_owner_settings enable row level security;
alter table public.rentadria_sync_jobs enable row level security;

comment on table public.rentadria_sync_partners is 'Import partners (XML/API) managed via admin panel; service role only.';
comment on table public.rentadria_import_owner_settings is 'Per-owner XML import settings; service role only.';
comment on table public.rentadria_sync_jobs is 'Sync logs for last runs; service role only.';

