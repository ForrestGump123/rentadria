-- Add metadata for scheduled expiry reminders and prevent duplicates.

alter table public.rentadria_owner_notifications
  add column if not exists ref_valid_until timestamptz,
  add column if not exists days_before int;

create unique index if not exists rentadria_owner_notifications_unique_reminder_idx
  on public.rentadria_owner_notifications (user_id, ref_valid_until, days_before)
  where ref_valid_until is not null and days_before is not null;

