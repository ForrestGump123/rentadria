-- Promotivni kodovi (admin) — čitanje/pisano samo preko Vercel API-ja (service role).
-- Pokreni u Supabase → SQL Editor jednom.

create table if not exists public.rentadria_promo_codes (
  id uuid primary key,
  code text not null,
  record jsonb not null,
  updated_at timestamptz not null default now()
);

create unique index if not exists rentadria_promo_codes_code_uq
  on public.rentadria_promo_codes (upper(trim(code)));

-- Jedna iskoristivost po vlasniku po kodu (idempotentno)
create table if not exists public.rentadria_promo_redemptions (
  promo_id uuid not null references public.rentadria_promo_codes (id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default now(),
  primary key (promo_id, user_id)
);

create index if not exists rentadria_promo_redemptions_user
  on public.rentadria_promo_redemptions (user_id);

alter table public.rentadria_promo_codes enable row level security;
alter table public.rentadria_promo_redemptions enable row level security;

-- Anon/authenticated korisnici nemaju politike; service role zaobilazi RLS.

comment on table public.rentadria_promo_codes is 'RentAdria admin promo codes; API + SUPABASE_SERVICE_ROLE_KEY';
comment on table public.rentadria_promo_redemptions is 'Jednom po user_id po promo kodu';
