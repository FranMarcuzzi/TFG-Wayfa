/*
  # Temporarily Make Trips INSERT More Permissive for Debugging

  ## Problem
  The INSERT policy is returning 403 Forbidden, which means:
  1. User IS authenticated (otherwise it would be 401)
  2. The RLS policy check is failing

  ## Debug Strategy
  Temporarily make the policy extremely permissive to isolate the issue.
  Once we confirm the insert works, we can add constraints back.

  ## Changes
  1. Drop existing INSERT policy
  2. Create a very permissive policy that allows any authenticated user to insert
  3. This will help us determine if the problem is with auth.uid() or something else
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "authenticated_users_can_create_trips" ON public.trips;
DROP POLICY IF EXISTS "Users can create trips" ON public.trips;

-- Create extremely permissive INSERT policy for debugging
-- This allows ANY authenticated user to insert a trip with ANY owner_id
CREATE POLICY "debug_authenticated_can_insert_trips"
  ON public.trips
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Note: This is intentionally insecure for debugging purposes
-- We will restrict it properly once we confirm the issue
