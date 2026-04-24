-- Admin gallery visibility/order per public listing id (server-backed; replaces localStorage).

create table if not exists public.rentadria_listing_gallery_admin (
  listing_id text primary key,
  owner_user_id text not null,
  blocked_urls jsonb not null default '[]'::jsonb,
  ordered_urls jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists rentadria_listing_gallery_admin_owner_idx
  on public.rentadria_listing_gallery_admin (owner_user_id);

alter table public.rentadria_listing_gallery_admin enable row level security;

comment on table public.rentadria_listing_gallery_admin is 'Per-listing gallery order and site-hidden image URLs; managed from admin panel.';
