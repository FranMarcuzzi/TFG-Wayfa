/*
  # Add Coordinates to Trips

  1. Changes to trips table
    - Add `lat` (numeric, nullable) - Latitude coordinate
    - Add `lng` (numeric, nullable) - Longitude coordinate
    - Add `place_id` (text, nullable) - Google Places ID for destination

  2. Notes
    - These fields are optional for backwards compatibility
    - Coordinates enable map functionality
    - place_id allows for place detail lookups
*/

-- Add lat column for latitude
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'lat'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN lat NUMERIC(10, 7);
  END IF;
END $$;

-- Add lng column for longitude
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'lng'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN lng NUMERIC(10, 7);
  END IF;
END $$;

-- Add place_id column for Google Places
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'place_id'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN place_id TEXT;
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN public.trips.lat IS 'Latitude coordinate of destination (optional)';
COMMENT ON COLUMN public.trips.lng IS 'Longitude coordinate of destination (optional)';
COMMENT ON COLUMN public.trips.place_id IS 'Google Places ID for destination (optional)';
