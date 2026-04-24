-- Soft delete support for registered owners (server-only).

alter table public.rentadria_registered_owners
  add column if not exists deleted_at timestamptz;

create index if not exists rentadria_registered_owners_deleted_at_idx
  on public.rentadria_registered_owners (deleted_at desc);

