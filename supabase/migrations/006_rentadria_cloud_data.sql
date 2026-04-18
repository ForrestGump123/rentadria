-- Central storage for owner dashboard rows, listing reviews, and public listing reports.
-- Access only via server (Supabase service role); RLS enabled without policies for anon.

-- Owner dashboard listing rows (synced across devices for the same account)
create table if not exists public.rentadria_owner_listings (
  id text primary key,
  user_id text not null,
  category text not null check (category in ('accommodation', 'car', 'motorcycle')),
  title text not null default '',
  views_month int not null default 0,
  contact_clicks_month int not null default 0,
  received_at text not null,
  expires_at text not null,
  featured_until text,
  internal_note text,
  public_listing_id text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rentadria_owner_listings_user_id_idx
  on public.rentadria_owner_listings (user_id);

-- Reviews per listing id (same key as former localStorage rentadria_reviews_<listingId>)
create table if not exists public.rentadria_listing_reviews (
  listing_id text primary key,
  reviews jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Visitor / user reports (listing abuse etc.)
create table if not exists public.rentadria_listing_reports (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists rentadria_listing_reports_created_idx
  on public.rentadria_listing_reports (created_at desc);

alter table public.rentadria_owner_listings enable row level security;
alter table public.rentadria_listing_reviews enable row level security;
alter table public.rentadria_listing_reports enable row level security;
