/*
  # Fix Trips Insert Policy and Auto-add Owner as Member

  ## Problem
  auth.uid() is not working correctly in RLS policies when using the anon key
  from the browser, even for authenticated users.

  ## Root Cause
  When using createClient with the anon key, the JWT token might not have
  the proper claims for auth.uid() to work in RLS policies.

  ## Solution
  1. Create a database function that inserts trips AND adds the owner as a member
  2. Make RLS policy permissive for this specific function
  3. Use SECURITY DEFINER to bypass RLS during the insert

  ## Changes
  1. Create function: create_trip_with_member(...)
  2. This function will:
     - Insert the trip
     - Automatically add owner as 'organizer' in trip_members
     - Return the created trip
  3. Grant execute permission to anon and authenticated
*/

-- Drop the debug policy
DROP POLICY IF EXISTS "debug_authenticated_can_insert_trips" ON public.trips;

-- Create a function to insert trip and add owner as member
CREATE OR REPLACE FUNCTION public.create_trip_with_member(
  p_title TEXT,
  p_destination TEXT DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  owner_id UUID,
  title TEXT,
  destination TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_trip_id UUID;
BEGIN
  -- Get the authenticated user's ID
  v_user_id := auth.uid();
  
  -- Check if user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Insert the trip
  INSERT INTO public.trips (owner_id, title, destination, start_date, end_date)
  VALUES (v_user_id, p_title, p_destination, p_start_date, p_end_date)
  RETURNING trips.id INTO v_trip_id;

  -- Add owner as organizer in trip_members
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (v_trip_id, v_user_id, 'organizer');

  -- Return the created trip
  RETURN QUERY
  SELECT t.id, t.owner_id, t.title, t.destination, t.start_date, t.end_date, t.created_at
  FROM public.trips t
  WHERE t.id = v_trip_id;
END;
$$;

-- Grant execute permission to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.create_trip_with_member TO anon;
GRANT EXECUTE ON FUNCTION public.create_trip_with_member TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.create_trip_with_member IS 
  'Creates a new trip and automatically adds the owner as an organizer member. Uses SECURITY DEFINER to bypass RLS.';
