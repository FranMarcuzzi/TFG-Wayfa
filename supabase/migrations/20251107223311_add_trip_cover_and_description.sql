/*\n  # Add Cover Image and Description to Trips\n\n  1. Changes to trips table\n    - Add `cover_url` (text, nullable) - URL to trip cover image\n    - Add `description` (text, nullable) - Trip description\n\n  2. Notes\n    - These fields are optional to maintain backwards compatibility\n    - Cover images can be stored in Supabase Storage or external URLs\n*/\n\n-- Add cover_url column for trip images\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'trips' AND column_name = 'cover_url'\n  ) THEN\n    ALTER TABLE public.trips ADD COLUMN cover_url TEXT;
\n  END IF;
\nEND $$;
\n\n-- Add description column for trip details\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.columns\n    WHERE table_name = 'trips' AND column_name = 'description'\n  ) THEN\n    ALTER TABLE public.trips ADD COLUMN description TEXT;
\n  END IF;
\nEND $$;
\n\n-- Add comment\nCOMMENT ON COLUMN public.trips.cover_url IS 'URL to trip cover image (optional)';
\nCOMMENT ON COLUMN public.trips.description IS 'Trip description (optional)';
\n;
