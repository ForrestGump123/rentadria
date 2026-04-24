-- Monthly metrics for public listing views and "show contact" clicks.
-- Entirely server-controlled (Supabase service role); RLS enabled, no anon policies.

create table if not exists public.rentadria_listing_metrics_monthly (
  id uuid primary key default gen_random_uuid(),
  ym text not null check (ym ~ '^[0-9]{4}-[0-9]{2}$'),
  public_listing_id text not null,
  owner_user_id text not null,
  views int not null default 0,
  contact_clicks int not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists rentadria_listing_metrics_monthly_unique_idx
  on public.rentadria_listing_metrics_monthly (ym, public_listing_id);

create index if not exists rentadria_listing_metrics_monthly_owner_idx
  on public.rentadria_listing_metrics_monthly (owner_user_id, ym);

alter table public.rentadria_listing_metrics_monthly enable row level security;

-- Track which month the counters in rentadria_owner_listings represent (so we can reset automatically).
alter table public.rentadria_owner_listings
  add column if not exists metrics_ym text;

comment on column public.rentadria_owner_listings.metrics_ym is 'YYYY-MM for views_month/contact_clicks_month counters';

-- Atomic increment via RPC (avoids race conditions).
create or replace function public.ra_increment_listing_metric(p_public_listing_id text, p_metric text)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_ym text := to_char(now(), 'YYYY-MM');
  v_user_id text;
begin
  -- Find owner listing row by public listing id.
  select user_id into v_user_id
  from public.rentadria_owner_listings
  where public_listing_id = p_public_listing_id
  limit 1;

  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if p_metric = 'view' then
    update public.rentadria_owner_listings
      set metrics_ym = v_ym,
          views_month = case when metrics_ym = v_ym then views_month + 1 else 1 end,
          contact_clicks_month = case when metrics_ym = v_ym then contact_clicks_month else 0 end,
          updated_at = now()
    where public_listing_id = p_public_listing_id;

    insert into public.rentadria_listing_metrics_monthly (ym, public_listing_id, owner_user_id, views, contact_clicks, updated_at)
      values (v_ym, p_public_listing_id, v_user_id, 1, 0, now())
    on conflict (ym, public_listing_id) do update
      set views = public.rentadria_listing_metrics_monthly.views + 1,
          owner_user_id = excluded.owner_user_id,
          updated_at = now();

  elsif p_metric = 'contact' then
    update public.rentadria_owner_listings
      set metrics_ym = v_ym,
          contact_clicks_month = case when metrics_ym = v_ym then contact_clicks_month + 1 else 1 end,
          views_month = case when metrics_ym = v_ym then views_month else 0 end,
          updated_at = now()
    where public_listing_id = p_public_listing_id;

    insert into public.rentadria_listing_metrics_monthly (ym, public_listing_id, owner_user_id, views, contact_clicks, updated_at)
      values (v_ym, p_public_listing_id, v_user_id, 0, 1, now())
    on conflict (ym, public_listing_id) do update
      set contact_clicks = public.rentadria_listing_metrics_monthly.contact_clicks + 1,
          owner_user_id = excluded.owner_user_id,
          updated_at = now();
  else
    return jsonb_build_object('ok', false, 'error', 'invalid_metric');
  end if;

  return jsonb_build_object('ok', true, 'ownerUserId', v_user_id, 'ym', v_ym);
end;
$$;

revoke all on function public.ra_increment_listing_metric(text, text) from public;

