-- Listing drafts stored in Supabase so edit works across devices.
-- Access only via server (Supabase service role); RLS enabled without anon policies.

create table if not exists public.rentadria_listing_drafts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  owner_row_id text not null,
  category text not null check (category in ('accommodation', 'car', 'motorcycle')),
  draft jsonb not null,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_user_id, owner_row_id, category)
);

create index if not exists rentadria_listing_drafts_owner_idx
  on public.rentadria_listing_drafts (owner_user_id, owner_row_id);

alter table public.rentadria_listing_drafts enable row level security;

comment on table public.rentadria_listing_drafts is 'Owner listing drafts (modal forms + gallery), server-only access.';

