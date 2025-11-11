/*
  # Create Trip Messages Table for Chat

  1. New Tables
    - `trip_messages`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `author_id` (uuid, foreign key to user_profiles)
      - `content` (text, message content)
      - `created_at` (timestamptz, auto-generated)
  
  2. Security
    - Enable RLS on `trip_messages` table
    - Add policies for trip members to read messages
    - Add policies for trip members to send messages
  
  3. Realtime
    - Enable realtime replication for live chat updates
  
  4. Notes
    - This table is specifically for trip chat messages
    - The existing 'messages' table is for internal Supabase realtime use
    - Foreign keys enable JOIN queries with trips and user_profiles
*/

-- Create trip_messages table
CREATE TABLE IF NOT EXISTS public.trip_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS trip_messages_trip_id_idx ON public.trip_messages(trip_id);
CREATE INDEX IF NOT EXISTS trip_messages_created_at_idx ON public.trip_messages(created_at);

-- Enable RLS
ALTER TABLE public.trip_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Trip members can read messages from their trips
CREATE POLICY "Trip members can read trip messages"
  ON public.trip_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_messages.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

-- Policy: Trip members can insert messages to their trips
CREATE POLICY "Trip members can send trip messages"
  ON public.trip_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_messages.trip_id
      AND trip_members.user_id = auth.uid()
    )
    AND author_id = auth.uid()
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;

-- Add comments
COMMENT ON TABLE public.trip_messages IS 'Chat messages for trips';
COMMENT ON COLUMN public.trip_messages.trip_id IS 'The trip this message belongs to';
COMMENT ON COLUMN public.trip_messages.author_id IS 'The user who sent this message';
COMMENT ON COLUMN public.trip_messages.content IS 'The message content';
