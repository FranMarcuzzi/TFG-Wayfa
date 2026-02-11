/*\n  # Fix Messages Foreign Key and Enable Realtime\n\n  1. Changes\n    - Add foreign key from messages.author_id to user_profiles.user_id\n    - Enable realtime replication for messages table\n    - This allows JOIN queries and live chat updates\n\n  2. Notes\n    - Foreign key needed for Supabase JOIN syntax\n    - Realtime needed for live chat functionality\n    - Uses ON DELETE CASCADE to clean up messages when users deleted\n*/\n\n-- Add the foreign key constraint for author_id\nDO $$\nBEGIN\n  IF NOT EXISTS (\n    SELECT 1 FROM information_schema.table_constraints \n    WHERE constraint_name = 'messages_author_id_fkey'\n    AND table_name = 'messages'\n  ) THEN\n    ALTER TABLE public.messages \n    ADD CONSTRAINT messages_author_id_fkey \n    FOREIGN KEY (author_id) \n    REFERENCES public.user_profiles(user_id) \n    ON DELETE CASCADE;
\n  END IF;
\nEND $$;
\n\n-- Enable realtime for messages table\nALTER PUBLICATION supabase_realtime ADD TABLE messages;
\n\n-- Add comment\nCOMMENT ON CONSTRAINT messages_author_id_fkey ON public.messages \nIS 'Links messages to user profiles for JOIN queries and author info';
\n;
