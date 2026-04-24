-- Admin banners stored in Supabase (server-only).

create table if not exists public.rentadria_admin_banners (
  id uuid primary key default gen_random_uuid(),
  slot text not null check (slot in ('slideshow', 'left', 'right', 'popup')),
  title text not null default '',
  description text not null default '',
  image_data_url text,
  countries text[] not null default '{}'::text[],
  start_date date,
  end_date date,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists rentadria_admin_banners_slot_idx
  on public.rentadria_admin_banners (slot, created_at desc);

alter table public.rentadria_admin_banners enable row level security;

