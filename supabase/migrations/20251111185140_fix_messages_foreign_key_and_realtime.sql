/*
  # Fix Messages Foreign Key and Enable Realtime

  1. Changes
    - Add foreign key from messages.author_id to user_profiles.user_id
    - Enable realtime replication for messages table
    - This allows JOIN queries and live chat updates

  2. Notes
    - Foreign key needed for Supabase JOIN syntax
    - Realtime needed for live chat functionality
    - Uses ON DELETE CASCADE to clean up messages when users deleted
*/

-- Add the foreign key constraint for author_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'messages_author_id_fkey'
    AND table_name = 'messages'
  ) THEN
    ALTER TABLE public.messages 
    ADD CONSTRAINT messages_author_id_fkey 
    FOREIGN KEY (author_id) 
    REFERENCES public.user_profiles(user_id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Add comment
COMMENT ON CONSTRAINT messages_author_id_fkey ON public.messages 
IS 'Links messages to user profiles for JOIN queries and author info';
