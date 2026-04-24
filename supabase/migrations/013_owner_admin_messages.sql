-- Owner ↔ Admin messaging stored in Supabase (server-only).

create table if not exists public.rentadria_owner_admin_threads (
  id uuid primary key default gen_random_uuid(),
  owner_user_id text not null,
  owner_email text,
  subject text not null default '',
  last_message text not null default '',
  last_from text not null default 'owner' check (last_from in ('owner','admin')),
  message_count int not null default 0,
  owner_last_seen_at timestamptz,
  admin_last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rentadria_owner_admin_threads_owner_idx
  on public.rentadria_owner_admin_threads (owner_user_id, updated_at desc);

create index if not exists rentadria_owner_admin_threads_updated_idx
  on public.rentadria_owner_admin_threads (updated_at desc);

create table if not exists public.rentadria_owner_admin_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.rentadria_owner_admin_threads (id) on delete cascade,
  from_party text not null check (from_party in ('owner','admin')),
  body text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists rentadria_owner_admin_messages_thread_idx
  on public.rentadria_owner_admin_messages (thread_id, created_at asc);

alter table public.rentadria_owner_admin_threads enable row level security;
alter table public.rentadria_owner_admin_messages enable row level security;

-- Atomic append + thread update (avoids race conditions).
create or replace function public.ra_append_owner_admin_message(p_thread_id uuid, p_from text, p_body text)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := now();
begin
  insert into public.rentadria_owner_admin_messages (thread_id, from_party, body, created_at)
    values (p_thread_id, p_from, p_body, v_now);

  update public.rentadria_owner_admin_threads
    set last_message = left(coalesce(p_body,''), 240),
        last_from = p_from,
        message_count = message_count + 1,
        updated_at = v_now
  where id = p_thread_id;

  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.ra_append_owner_admin_message(uuid, text, text) from public;

