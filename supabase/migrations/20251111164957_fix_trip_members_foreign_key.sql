/*
  # Fix Trip Members Foreign Key to User Profiles

  1. Changes
    - Drop existing foreign key if it exists (to recreate it properly)
    - Add foreign key from trip_members.user_id to user_profiles.user_id
    - This enables Supabase client to perform JOIN queries

  2. Notes
    - Foreign key is needed for Supabase's automatic JOIN syntax
    - Uses ON DELETE CASCADE to clean up when users are deleted
*/

-- Drop the foreign key if it exists (just in case)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trip_members_user_id_fkey'
    AND table_name = 'trip_members'
  ) THEN
    ALTER TABLE public.trip_members DROP CONSTRAINT trip_members_user_id_fkey;
  END IF;
END $$;

-- Add the foreign key constraint
ALTER TABLE public.trip_members 
ADD CONSTRAINT trip_members_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.user_profiles(user_id) 
ON DELETE CASCADE;

-- Add comment
COMMENT ON CONSTRAINT trip_members_user_id_fkey ON public.trip_members 
IS 'Links trip members to user profiles for JOIN queries';
