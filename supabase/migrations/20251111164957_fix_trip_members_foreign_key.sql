/*\n  # Fix Trip Members Foreign Key to User Profiles\n\n  1. Changes\n    - Drop existing foreign key if it exists (to recreate it properly)\n    - Add foreign key from trip_members.user_id to user_profiles.user_id\n    - This enables Supabase client to perform JOIN queries\n\n  2. Notes\n    - Foreign key is needed for Supabase's automatic JOIN syntax\n    - Uses ON DELETE CASCADE to clean up when users are deleted\n*/\n\n-- Drop the foreign key if it exists (just in case)\nDO $$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM information_schema.table_constraints \n    WHERE constraint_name = 'trip_members_user_id_fkey'\n    AND table_name = 'trip_members'\n  ) THEN\n    ALTER TABLE public.trip_members DROP CONSTRAINT trip_members_user_id_fkey;
\n  END IF;
\nEND $$;
\n\n-- Add the foreign key constraint\nALTER TABLE public.trip_members \nADD CONSTRAINT trip_members_user_id_fkey \nFOREIGN KEY (user_id) \nREFERENCES public.user_profiles(user_id) \nON DELETE CASCADE;
\n\n-- Add comment\nCOMMENT ON CONSTRAINT trip_members_user_id_fkey ON public.trip_members \nIS 'Links trip members to user profiles for JOIN queries';
\n;
