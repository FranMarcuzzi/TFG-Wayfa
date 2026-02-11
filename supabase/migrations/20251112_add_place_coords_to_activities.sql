-- Add place_id and coordinates to activities
ALTER TABLE public.activities
  ADD COLUMN IF NOT EXISTS place_id text NULL,
  ADD COLUMN IF NOT EXISTS lat double precision NULL,
  ADD COLUMN IF NOT EXISTS lng double precision NULL;
-- Helpful indexes
CREATE INDEX IF NOT EXISTS activities_place_id_idx ON public.activities (place_id);
CREATE INDEX IF NOT EXISTS activities_lat_lng_idx ON public.activities (lat, lng);
