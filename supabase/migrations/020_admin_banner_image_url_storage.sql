-- Public URL to image in Supabase Storage (preferred). Legacy rows may still use image_data_url only.
alter table public.rentadria_admin_banners
  add column if not exists image_url text;

comment on column public.rentadria_admin_banners.image_url is 'Public storage URL; when set, image_data_url should be null.';

-- Bucket for marketing banner images (public read; writes via service role API only).
insert into storage.buckets (id, name, public)
values ('admin-banners', 'admin-banners', true)
on conflict (id) do update set public = excluded.public;

-- Anyone can read banner images (URLs are embedded on the public site).
drop policy if exists "admin_banners_public_read" on storage.objects;
create policy "admin_banners_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'admin-banners');
