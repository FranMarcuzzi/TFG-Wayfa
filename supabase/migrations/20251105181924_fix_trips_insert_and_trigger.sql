/*\n  # Fix Trips INSERT Policy and Trigger Execution\n\n  ## Problem\n  The INSERT policy on trips is failing because the trigger that inserts into\n  trip_members might be causing issues. Even though the trigger has SECURITY DEFINER,\n  there might be a problem with how the policies interact.\n\n  ## Solution\n  1. Ensure the trips INSERT policy is correct\n  2. Make sure the trigger function has proper permissions\n  3. Grant necessary permissions to the function\n\n  ## Changes\n  1. Recreate the trigger function with proper grants\n  2. Ensure authenticated users can insert into trips\n*/\n\n-- Recreate the trigger function with explicit grants\nCREATE OR REPLACE FUNCTION public.add_trip_owner_as_organizer()\nRETURNS TRIGGER\nSECURITY DEFINER\nSET search_path = public\nAS $$\nBEGIN\n  INSERT INTO public.trip_members (trip_id, user_id, role)\n  VALUES (NEW.id, NEW.owner_id, 'organizer');
\n  RETURN NEW;
\nEND;
\n$$ LANGUAGE plpgsql;
\n\n-- Grant execute permission on the function to authenticated users\nGRANT EXECUTE ON FUNCTION public.add_trip_owner_as_organizer() TO authenticated;
\n\n-- Ensure the trigger exists\nDROP TRIGGER IF EXISTS on_trip_created ON public.trips;
\nCREATE TRIGGER on_trip_created\n  AFTER INSERT ON public.trips\n  FOR EACH ROW\n  EXECUTE FUNCTION public.add_trip_owner_as_organizer();
\n;
