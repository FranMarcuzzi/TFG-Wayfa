/*
  # Add Foreign Keys to User Profiles

  1. Changes
    - Add foreign key from messages.author_id to user_profiles.user_id
    - Add foreign key from trip_members.user_id to user_profiles.user_id (if not exists)
    - Add foreign key from polls.created_by to user_profiles.user_id
    - Add foreign key from poll_votes.user_id to user_profiles.user_id
    - Add foreign key from trip_invitations.invited_by to user_profiles.user_id

  2. Notes
    - This enables JOIN queries to get user profile information
    - Uses ON DELETE CASCADE to clean up when users are deleted
*/

-- Add foreign key for messages.author_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_author_id_fkey'
  ) THEN
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_author_id_fkey 
    FOREIGN KEY (author_id) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key for trip_members.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trip_members_user_id_fkey'
  ) THEN
    ALTER TABLE public.trip_members 
    ADD CONSTRAINT trip_members_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key for polls.created_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'polls_created_by_fkey'
  ) THEN
    ALTER TABLE public.polls 
    ADD CONSTRAINT polls_created_by_fkey 
    FOREIGN KEY (created_by) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key for poll_votes.user_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'poll_votes_user_id_fkey'
  ) THEN
    ALTER TABLE public.poll_votes 
    ADD CONSTRAINT poll_votes_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key for trip_invitations.invited_by
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'trip_invitations_invited_by_fkey'
  ) THEN
    ALTER TABLE public.trip_invitations 
    ADD CONSTRAINT trip_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Add comments
COMMENT ON CONSTRAINT messages_author_id_fkey ON public.messages IS 'Links messages to user profiles';
COMMENT ON CONSTRAINT trip_members_user_id_fkey ON public.trip_members IS 'Links trip members to user profiles';
COMMENT ON CONSTRAINT polls_created_by_fkey ON public.polls IS 'Links polls to user who created them';
COMMENT ON CONSTRAINT poll_votes_user_id_fkey ON public.poll_votes IS 'Links poll votes to users';
COMMENT ON CONSTRAINT trip_invitations_invited_by_fkey ON public.trip_invitations IS 'Links invitations to user who sent them';
