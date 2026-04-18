-- Proširenje profila vlasnika (avatar, promo scope) — čuva se u Supabase-u uz ostale kolone u rentadria_registered_owners.
-- Pokreni nakon 004/005. Avatar je data URL (ograničen u aplikaciji); za veće fajlove kasnije Storage.

alter table public.rentadria_registered_owners
  add column if not exists avatar_data_url text,
  add column if not exists promo_category_scope jsonb;

comment on column public.rentadria_registered_owners.avatar_data_url is 'JPEG data URL (smanjeno na klijentu); opcionalno';
comment on column public.rentadria_registered_owners.promo_category_scope is 'Niz kategorija iz promotivnog koda, npr. ["accommodation","car"]';
