-- Add type column to activities
alter table public.activities
add column if not exists type text check (type in ('food','museum','sightseeing','transport','other')) default 'other';
