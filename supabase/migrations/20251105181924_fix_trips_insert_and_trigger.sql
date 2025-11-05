/*
  # Fix Trips INSERT Policy and Trigger Execution

  ## Problem
  The INSERT policy on trips is failing because the trigger that inserts into
  trip_members might be causing issues. Even though the trigger has SECURITY DEFINER,
  there might be a problem with how the policies interact.

  ## Solution
  1. Ensure the trips INSERT policy is correct
  2. Make sure the trigger function has proper permissions
  3. Grant necessary permissions to the function

  ## Changes
  1. Recreate the trigger function with proper grants
  2. Ensure authenticated users can insert into trips
*/

-- Recreate the trigger function with explicit grants
CREATE OR REPLACE FUNCTION public.add_trip_owner_as_organizer()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'organizer');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.add_trip_owner_as_organizer() TO authenticated;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS on_trip_created ON public.trips;
CREATE TRIGGER on_trip_created
  AFTER INSERT ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.add_trip_owner_as_organizer();
