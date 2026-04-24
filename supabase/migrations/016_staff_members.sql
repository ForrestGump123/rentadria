-- Admin staff members (agents / subadmins) stored in Supabase.
-- Auth is handled via server-side API (service role), RLS stays enabled.

create table if not exists public.rentadria_staff_members (
  id uuid primary key,
  email text not null,
  name text not null,
  password_hash text not null,
  role text not null,
  blocked boolean not null default false,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists rentadria_staff_members_email_uq
  on public.rentadria_staff_members (lower(trim(email)));

alter table public.rentadria_staff_members enable row level security;

comment on table public.rentadria_staff_members is 'RentAdria admin staff/agents; managed via Vercel API with service role.';

