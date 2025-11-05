/*
  # Add Policies for Anonymous (Authenticated) Users

  ## Problem
  The client is sending requests with the anon key, and even though users
  are authenticated, Supabase is treating them as the 'anon' role instead
  of the 'authenticated' role.

  ## Solution
  Add duplicate policies for the 'anon' role that mirror the 'authenticated'
  policies. This is a workaround for when the JWT doesn't properly elevate
  the role from anon to authenticated.

  ## Changes
  1. Add INSERT policy for anon role (with proper owner_id check)
  2. Add SELECT policy for anon role
  3. Add UPDATE policy for anon role
  4. Add DELETE policy for anon role
*/

-- INSERT: Anon users can create trips (if they have a valid auth.uid())
CREATE POLICY "anon_can_insert_trips"
  ON public.trips
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
  );

-- SELECT: Anon users can view trips they are members of
CREATE POLICY "anon_can_view_trips"
  ON public.trips
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trip_members
      WHERE trip_members.trip_id = trips.id
        AND trip_members.user_id = auth.uid()
    )
  );

-- UPDATE: Anon users can update their own trips
CREATE POLICY "anon_can_update_trips"
  ON public.trips
  FOR UPDATE
  TO anon
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- DELETE: Anon users can delete their own trips
CREATE POLICY "anon_can_delete_trips"
  ON public.trips
  FOR DELETE
  TO anon
  USING (auth.uid() = owner_id);
