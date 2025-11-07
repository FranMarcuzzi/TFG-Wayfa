/*
  # Add Cover Image and Description to Trips

  1. Changes to trips table
    - Add `cover_url` (text, nullable) - URL to trip cover image
    - Add `description` (text, nullable) - Trip description

  2. Notes
    - These fields are optional to maintain backwards compatibility
    - Cover images can be stored in Supabase Storage or external URLs
*/

-- Add cover_url column for trip images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN cover_url TEXT;
  END IF;
END $$;

-- Add description column for trip details
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trips' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.trips ADD COLUMN description TEXT;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.trips.cover_url IS 'URL to trip cover image (optional)';
COMMENT ON COLUMN public.trips.description IS 'Trip description (optional)';
