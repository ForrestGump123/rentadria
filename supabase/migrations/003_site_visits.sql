-- Site visits tracking (persistent on Vercel).
-- One visit = one browser (visitor_id) per calendar day (Europe/Belgrade).

create table if not exists public.rentadria_site_visits (
  id bigserial primary key,
  day text not null, -- yyyy-mm-dd (Belgrade)
  visitor_id uuid not null,
  country_code text not null default 'XX',
  city text not null default '—',
  created_at timestamptz not null default now()
);

-- Ensure "once per day per visitor"
create unique index if not exists rentadria_site_visits_day_visitor_uq
  on public.rentadria_site_visits (day, visitor_id);

create index if not exists rentadria_site_visits_day_idx
  on public.rentadria_site_visits (day);

create index if not exists rentadria_site_visits_day_cc_idx
  on public.rentadria_site_visits (day, country_code);

