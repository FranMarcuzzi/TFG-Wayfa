-- Add cover_url and description to trips
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS cover_url text,
  ADD COLUMN IF NOT EXISTS description text;
