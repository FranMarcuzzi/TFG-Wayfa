-- Extend activity type check constraint to allow hotel and flight
alter table public.activities
  drop constraint if exists activities_type_check;
alter table public.activities
  add constraint activities_type_check
  check (type in ('food','museum','sightseeing','transport','hotel','flight','other'));
