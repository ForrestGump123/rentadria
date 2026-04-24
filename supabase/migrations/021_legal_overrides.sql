-- Legal pages overrides stored on server per locale and kind.

create table if not exists public.rentadria_legal_overrides (
  kind text not null check (kind in ('terms','privacy','faq')),
  locale text not null check (locale in ('cnr','en','sq','it','es')),
  content jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (kind, locale)
);

create index if not exists rentadria_legal_overrides_kind_locale_idx
  on public.rentadria_legal_overrides (kind, locale);

alter table public.rentadria_legal_overrides enable row level security;

