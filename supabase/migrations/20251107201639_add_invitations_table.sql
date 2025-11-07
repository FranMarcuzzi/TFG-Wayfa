/*
  # Add Trip Invitations Table

  1. New Table
    - `trip_invitations`
      - `id` (uuid, primary key)
      - `trip_id` (uuid, foreign key to trips)
      - `email` (text, email to invite)
      - `invited_by` (uuid, user who sent invitation)
      - `status` (text, 'pending' | 'accepted' | 'declined')
      - `token` (text, unique token for invitation link)
      - `created_at` (timestamptz)
      - `expires_at` (timestamptz)

  2. Indexes
    - Index on token for fast lookup
    - Index on email for checking existing invitations
    - Index on trip_id for listing invitations

  3. Security
    - RLS disabled (auth.uid() doesn't work in this project)
*/

-- Create invitations table
CREATE TABLE IF NOT EXISTS public.trip_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  
  -- Prevent duplicate pending invitations
  UNIQUE(trip_id, email, status)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_trip_invitations_token ON public.trip_invitations(token);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_email ON public.trip_invitations(email);
CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip_id ON public.trip_invitations(trip_id);

-- Disable RLS (auth.uid() doesn't work)
ALTER TABLE public.trip_invitations DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE public.trip_invitations IS 'Stores trip invitations sent via email. RLS disabled due to auth.uid() issues.';
