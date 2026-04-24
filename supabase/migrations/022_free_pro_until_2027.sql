-- Backfill: grant Free Pro promo until 31.12.2027 to existing owners.
-- Applies to: registered_at <= cutoff, not agency, no admin plan_override, and current valid_until is missing or earlier than cutoff.

do $$
declare
  cutoff timestamptz := '2027-12-31T22:59:59.999Z'::timestamptz;
begin
  update public.rentadria_registered_owners
  set
    plan = 'pro',
    subscription_active = true,
    valid_until = cutoff,
    updated_at = now()
  where
    deleted_at is null
    and registered_at <= cutoff
    and coalesce(plan, '') <> 'agency'
    and coalesce((admin_meta->>'plan_override')::boolean, false) = false
    and (
      valid_until is null
      or valid_until < cutoff
      or plan is null
      or plan = 'basic'
      or plan = 'pro'
    );
end $$;

