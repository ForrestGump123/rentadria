-- Public Storage bucket for rendered social sharing images.
-- Service role uploads images; public read lets Meta fetch image_url.

insert into storage.buckets (id, name, public)
values ('social-render', 'social-render', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "social_render_public_read" on storage.objects;
create policy "social_render_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'social-render');
