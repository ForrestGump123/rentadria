-- Store owner avatar as URL in Storage (avoid large data URLs in DB).

alter table public.rentadria_registered_owners
  add column if not exists avatar_url text;

comment on column public.rentadria_registered_owners.avatar_url is
  'Public storage URL for owner avatar. When set, avatar_data_url should be null.';

insert into storage.buckets (id, name, public)
values ('owner-avatars', 'owner-avatars', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "owner_avatars_public_read" on storage.objects;
create policy "owner_avatars_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'owner-avatars');

