-- Registrovani vlasnici (verifikacija emaila) — čitanje/pisano preko Vercel API-ja (service role).
-- Omogućava prijavu s drugog uređaja i listu u adminu kad je Supabase podešen.
-- Pokreni u Supabase → SQL Editor jednom (isti projekat kao SUPABASE_URL).

create table if not exists public.rentadria_registered_owners (
  user_id text primary key,
  email text not null,
  display_name text not null,
  phone text,
  country_id text,
  password_hash text,
  registered_at timestamptz not null default now(),
  plan_pending text,
  promo_code text,
  updated_at timestamptz not null default now()
);

create index if not exists rentadria_registered_owners_registered_at
  on public.rentadria_registered_owners (registered_at desc);

alter table public.rentadria_registered_owners enable row level security;

comment on table public.rentadria_registered_owners is 'RentAdria owner accounts after email verify; API + SUPABASE_SERVICE_ROLE_KEY';
