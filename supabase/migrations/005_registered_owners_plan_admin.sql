-- Plan, pretplata i admin meta za vlasnike (sinkronizacija s Vercel API-jem).

alter table public.rentadria_registered_owners
  add column if not exists plan text,
  add column if not exists subscription_active boolean not null default false,
  add column if not exists valid_until timestamptz,
  add column if not exists basic_category_choice text,
  add column if not exists admin_meta jsonb;

comment on column public.rentadria_registered_owners.plan is 'basic | pro | agency ili null';
comment on column public.rentadria_registered_owners.admin_meta is 'Admin: extra kategorije, slotovi, blocked, xmlImportUrl…';
