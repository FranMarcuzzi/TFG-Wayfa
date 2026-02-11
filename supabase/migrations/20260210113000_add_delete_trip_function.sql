/*
  # Add secure trip delete function

  Ensures trip owners can delete trips even when RLS blocks direct DELETE.
*/

CREATE OR REPLACE FUNCTION public.delete_trip(p_trip_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = p_trip_id
      AND owner_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  DELETE FROM public.trips WHERE id = p_trip_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_trip(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_trip(uuid) TO anon;
