-- Run this in Supabase → SQL Editor (once), then create Storage bucket (see comment at end).
--
-- VAŽNO: izvrši CIJELI ovaj fajl od prve linije do zadnje (Ctrl+A → paste → Run).
-- Ako pokreneš samo dio od riječi "begin" bez bloka "declare ..." iznad, PostgreSQL
-- tretira v_sched kao ime tabele → greška: relation "v_sched" does not exist.

create table if not exists public.social_meta (
  id int primary key check (id = 1),
  next_slot_at timestamptz not null default now()
);

insert into public.social_meta (id, next_slot_at)
values (1, now())
on conflict (id) do nothing;

create table if not exists public.social_queue (
  id uuid primary key default gen_random_uuid(),
  listing_public_id text not null,
  category text not null,
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'done', 'failed')),
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  instagram_media_id text,
  facebook_post_id text
);

create index if not exists idx_social_queue_due
  on public.social_queue (scheduled_for)
  where status = 'pending';

-- Atomically reserve the next 10-minute slot for posting.
create or replace function public.enqueue_social_post(
  p_listing_public_id text,
  p_category text,
  p_payload jsonb
) returns uuid
language plpgsql
as $$
declare
  v_sched timestamptz;
  v_id uuid;
begin
  perform 1 from public.social_meta where id = 1 for update;
  select next_slot_at into v_sched from public.social_meta where id = 1;
  v_sched := greatest(now(), v_sched);
  insert into public.social_queue (listing_public_id, category, payload, scheduled_for)
  values (p_listing_public_id, p_category, p_payload, v_sched)
  returning id into v_id;
  update public.social_meta
  set next_slot_at = v_sched + interval '10 minutes'
  where id = 1;
  return v_id;
end;
$$;

-- Storage: Dashboard → Storage → New bucket → name: social-render → Public bucket ON.
-- (Service role uploads; public read for Meta to fetch image_url.)
