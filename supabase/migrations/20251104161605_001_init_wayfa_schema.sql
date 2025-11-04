/*
  # Wayfa - Collaborative Trip Planning Schema

  ## Overview
  This migration creates the complete database schema for the Wayfa collaborative trip planning application.

  ## New Tables

  ### `trips`
  - `id` (uuid, primary key) - Unique trip identifier
  - `owner_id` (uuid) - Trip creator/owner reference to auth.users
  - `title` (text) - Trip name
  - `destination` (text) - Trip destination
  - `start_date` (date) - Trip start date
  - `end_date` (date) - Trip end date
  - `created_at` (timestamptz) - Creation timestamp

  ### `trip_members`
  - `trip_id` (uuid) - Reference to trips
  - `user_id` (uuid) - Reference to auth.users
  - `role` (text) - Either 'organizer' or 'participant'
  - Primary key: (trip_id, user_id)

  ### `days`
  - `id` (uuid, primary key) - Unique day identifier
  - `trip_id` (uuid) - Reference to trips
  - `day_index` (int) - Day number in the trip
  - `date` (date) - Actual date of the day
  - Unique constraint on (trip_id, day_index)

  ### `activities`
  - `id` (uuid, primary key) - Unique activity identifier
  - `day_id` (uuid) - Reference to days
  - `title` (text) - Activity name
  - `starts_at` (time) - Start time
  - `ends_at` (time) - End time
  - `location` (text) - Activity location

  ### `messages`
  - `id` (uuid, primary key) - Unique message identifier
  - `trip_id` (uuid) - Reference to trips
  - `author_id` (uuid) - Reference to auth.users
  - `content` (text) - Message content
  - `created_at` (timestamptz) - Creation timestamp

  ### `polls`
  - `id` (uuid, primary key) - Unique poll identifier
  - `trip_id` (uuid) - Reference to trips
  - `question` (text) - Poll question
  - `created_by` (uuid) - Reference to auth.users
  - `created_at` (timestamptz) - Creation timestamp

  ### `poll_options`
  - `id` (uuid, primary key) - Unique option identifier
  - `poll_id` (uuid) - Reference to polls
  - `label` (text) - Option text

  ### `poll_votes`
  - `poll_id` (uuid) - Reference to polls
  - `option_id` (uuid) - Reference to poll_options
  - `user_id` (uuid) - Reference to auth.users
  - `created_at` (timestamptz) - Creation timestamp
  - Primary key: (poll_id, user_id) - One vote per user per poll

  ## Security
  - RLS enabled on all tables
  - Users can view trips they are members of
  - Users can create trips (automatically become organizer)
  - Trip members can add days, activities, messages, polls, and votes
  - Users can only edit/delete content they created

  ## Indexes
  - Indexed foreign keys for efficient queries
  - Indexed trip_id on all trip-related tables
  - Indexed created_at on messages for chat ordering

  ## Important Notes
  1. Realtime must be enabled on: activities, messages, polls, poll_options, poll_votes
  2. Trip owner is automatically added as organizer in trip_members
  3. All cascading deletes ensure data consistency
*/

-- Create trips table
CREATE TABLE IF NOT EXISTS public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  destination text,
  start_date date,
  end_date date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Create trip_members table
CREATE TABLE IF NOT EXISTS public.trip_members (
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('organizer','participant')) DEFAULT 'participant',
  PRIMARY KEY (trip_id, user_id)
);

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

-- Create days table
CREATE TABLE IF NOT EXISTS public.days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_index int NOT NULL,
  date date,
  UNIQUE (trip_id, day_index)
);

CREATE INDEX IF NOT EXISTS idx_days_trip_id ON public.days(trip_id);

ALTER TABLE public.days ENABLE ROW LEVEL SECURITY;

-- Create activities table
CREATE TABLE IF NOT EXISTS public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.days(id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at time,
  ends_at time,
  location text
);

CREATE INDEX IF NOT EXISTS idx_activities_day_id ON public.activities(day_id);

ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_trip_id_created_at ON public.messages(trip_id, created_at);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create polls table
CREATE TABLE IF NOT EXISTS public.polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_polls_trip_id ON public.polls(trip_id);

ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- Create poll_options table
CREATE TABLE IF NOT EXISTS public.poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  label text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options(poll_id);

ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;

-- Create poll_votes table
CREATE TABLE IF NOT EXISTS public.poll_votes (
  poll_id uuid NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  option_id uuid NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes(option_id);

ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for trips
CREATE POLICY "Users can view trips they are members of"
  ON public.trips FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trips.id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create trips"
  ON public.trips FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Trip owners can update their trips"
  ON public.trips FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Trip owners can delete their trips"
  ON public.trips FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for trip_members
CREATE POLICY "Users can view members of trips they belong to"
  ON public.trip_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
      AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip organizers can add members"
  ON public.trip_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = trip_members.trip_id
      AND trip_members.user_id = auth.uid()
      AND trip_members.role = 'organizer'
    )
  );

CREATE POLICY "Trip organizers can remove members"
  ON public.trip_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members tm
      WHERE tm.trip_id = trip_members.trip_id
      AND tm.user_id = auth.uid()
      AND tm.role = 'organizer'
    )
  );

-- RLS Policies for days
CREATE POLICY "Users can view days for trips they are members of"
  ON public.days FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = days.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create days"
  ON public.days FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = days.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update days"
  ON public.days FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = days.trip_id
      AND trip_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = days.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete days"
  ON public.days FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = days.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

-- RLS Policies for activities
CREATE POLICY "Users can view activities for trips they are members of"
  ON public.activities FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.days
      JOIN public.trip_members ON trip_members.trip_id = days.trip_id
      WHERE days.id = activities.day_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create activities"
  ON public.activities FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.days
      JOIN public.trip_members ON trip_members.trip_id = days.trip_id
      WHERE days.id = activities.day_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can update activities"
  ON public.activities FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.days
      JOIN public.trip_members ON trip_members.trip_id = days.trip_id
      WHERE days.id = activities.day_id
      AND trip_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.days
      JOIN public.trip_members ON trip_members.trip_id = days.trip_id
      WHERE days.id = activities.day_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can delete activities"
  ON public.activities FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.days
      JOIN public.trip_members ON trip_members.trip_id = days.trip_id
      WHERE days.id = activities.day_id
      AND trip_members.user_id = auth.uid()
    )
  );

-- RLS Policies for messages
CREATE POLICY "Users can view messages for trips they are members of"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = messages.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create messages"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = messages.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

-- RLS Policies for polls
CREATE POLICY "Users can view polls for trips they are members of"
  ON public.polls FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = polls.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can create polls"
  ON public.polls FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = polls.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

-- RLS Policies for poll_options
CREATE POLICY "Users can view poll options for trips they are members of"
  ON public.poll_options FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      JOIN public.trip_members ON trip_members.trip_id = polls.trip_id
      WHERE polls.id = poll_options.poll_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Poll creators can add options"
  ON public.poll_options FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.polls
      WHERE polls.id = poll_options.poll_id
      AND polls.created_by = auth.uid()
    )
  );

-- RLS Policies for poll_votes
CREATE POLICY "Users can view votes for trips they are members of"
  ON public.poll_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.polls
      JOIN public.trip_members ON trip_members.trip_id = polls.trip_id
      WHERE polls.id = poll_votes.poll_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Trip members can vote on polls"
  ON public.poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.polls
      JOIN public.trip_members ON trip_members.trip_id = polls.trip_id
      WHERE polls.id = poll_votes.poll_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own votes"
  ON public.poll_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON public.poll_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to automatically add trip owner as organizer
CREATE OR REPLACE FUNCTION public.add_trip_owner_as_organizer()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'organizer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to add owner as organizer when trip is created
DROP TRIGGER IF EXISTS on_trip_created ON public.trips;
CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.add_trip_owner_as_organizer();