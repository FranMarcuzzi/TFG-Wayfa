/*
  # Fix All Trip Creation Issues - Complete Solution

  ## Problems Identified
  1. RLS policies block INSERT even with auth.uid() = owner_id
  2. Trigger on_trip_created adds owner to trip_members
  3. Function create_trip_with_member ALSO adds owner to trip_members
  4. Result: Duplicate key constraint violation

  ## Complete Solution
  1. Keep the trigger (simpler approach)
  2. Remove the function create_trip_with_member
  3. Fix the RLS policies to allow authenticated users to insert
  4. Use a more permissive INSERT policy that checks auth.uid() IS NOT NULL

  ## Changes
  1. Drop the create_trip_with_member function
  2. Update RLS policies for trips to be more permissive
  3. Keep the trigger for automatic trip_members insertion
*/

-- ============================================================================
-- 1. Drop the function we just created (causes duplicates)
-- ============================================================================

DROP FUNCTION IF EXISTS public.create_trip_with_member;

-- ============================================================================
-- 2. Drop ALL existing INSERT policies for trips
-- ============================================================================

DROP POLICY IF EXISTS "anon_can_insert_trips" ON public.trips;
DROP POLICY IF EXISTS "Users can create trips" ON public.trips;
DROP POLICY IF EXISTS "authenticated_can_insert_trips" ON public.trips;

-- ============================================================================
-- 3. Create a SINGLE, WORKING INSERT policy for trips
-- ============================================================================

-- For AUTHENTICATED role: allow insert if user sets themselves as owner
CREATE POLICY "authenticated_users_can_create_trips"
  ON public.trips
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
  );

-- For ANON role: allow insert if user sets themselves as owner
-- This is needed because the Supabase client uses anon role even when authenticated
CREATE POLICY "anon_users_can_create_trips"
  ON public.trips
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() IS NOT NULL 
    AND owner_id = auth.uid()
  );

-- ============================================================================
-- 4. Verify trigger exists and is correct
-- ============================================================================

-- Recreate the trigger function to be safe
CREATE OR REPLACE FUNCTION public.add_trip_owner_as_organizer()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Add owner as organizer in trip_members
  -- Use INSERT with ON CONFLICT to avoid duplicates
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'organizer')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_trip_created ON public.trips;

CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION add_trip_owner_as_organizer();

-- ============================================================================
-- 5. Grant necessary permissions
-- ============================================================================

-- Make sure anon and authenticated can execute the trigger function
GRANT EXECUTE ON FUNCTION public.add_trip_owner_as_organizer TO anon;
GRANT EXECUTE ON FUNCTION public.add_trip_owner_as_organizer TO authenticated;
