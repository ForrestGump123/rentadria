-- Pricing plans overrides stored on server per locale.

create table if not exists public.rentadria_pricing_overrides (
  locale text primary key check (locale in ('cnr','en','sq','it','es')),
  plans jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.rentadria_pricing_overrides enable row level security;

