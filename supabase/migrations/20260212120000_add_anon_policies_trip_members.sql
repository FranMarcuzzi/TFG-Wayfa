/*
  # Add anon policies for trip_members

  The client uses the anon role even for authenticated users, so we need anon
  policies here to allow reading and managing trip_members.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trip_members'
      AND policyname = 'anon_select_trip_members'
  ) THEN
    EXECUTE $$
      CREATE POLICY "anon_select_trip_members"
        ON public.trip_members
        FOR SELECT
        TO anon
        USING (true)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trip_members'
      AND policyname = 'anon_insert_trip_members'
  ) THEN
    EXECUTE $$
      CREATE POLICY "anon_insert_trip_members"
        ON public.trip_members
        FOR INSERT
        TO anon
        WITH CHECK (true)
    $$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'trip_members'
      AND policyname = 'anon_delete_trip_members'
  ) THEN
    EXECUTE $$
      CREATE POLICY "anon_delete_trip_members"
        ON public.trip_members
        FOR DELETE
        TO anon
        USING (true)
    $$;
  END IF;
END $$;
