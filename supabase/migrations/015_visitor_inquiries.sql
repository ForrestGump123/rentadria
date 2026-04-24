-- Visitor inquiries stored in Supabase (server-only).

create table if not exists public.rentadria_visitor_inquiries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  listing_id text not null,
  listing_title text not null default '',
  guest_first text not null default '',
  guest_last text not null default '',
  guest_email text not null default '',
  guest_phone text not null default '',
  period text not null default '',
  guests text not null default '',
  message text not null default '',
  paused boolean not null default false,
  owner_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rentadria_visitor_inquiries_owner_idx
  on public.rentadria_visitor_inquiries (owner_user_id, created_at desc);

create index if not exists rentadria_visitor_inquiries_created_idx
  on public.rentadria_visitor_inquiries (created_at desc);

alter table public.rentadria_visitor_inquiries enable row level security;

-- Unread counters per owner (badge); admin badge computed separately if desired.
create table if not exists public.rentadria_owner_inquiry_unread (
  owner_user_id text primary key,
  unread_count int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.rentadria_owner_inquiry_unread enable row level security;

-- Atomic helper for insert + unread increment.
create or replace function public.ra_insert_inquiry_and_bump_unread(
  p_owner_user_id text,
  p_listing_id text,
  p_listing_title text,
  p_guest_first text,
  p_guest_last text,
  p_guest_email text,
  p_guest_phone text,
  p_period text,
  p_guests text,
  p_message text
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_id uuid;
begin
  insert into public.rentadria_visitor_inquiries (
    owner_user_id, listing_id, listing_title,
    guest_first, guest_last, guest_email, guest_phone,
    period, guests, message, created_at, updated_at
  )
  values (
    p_owner_user_id, p_listing_id, p_listing_title,
    p_guest_first, p_guest_last, p_guest_email, p_guest_phone,
    p_period, p_guests, p_message, now(), now()
  )
  returning id into v_id;

  insert into public.rentadria_owner_inquiry_unread (owner_user_id, unread_count, updated_at)
    values (p_owner_user_id, 1, now())
  on conflict (owner_user_id) do update
    set unread_count = public.rentadria_owner_inquiry_unread.unread_count + 1,
        updated_at = now();

  return v_id;
end;
$$;

revoke all on function public.ra_insert_inquiry_and_bump_unread(text, text, text, text, text, text, text, text, text, text) from public;

