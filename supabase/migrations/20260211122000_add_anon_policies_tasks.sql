/*
  # Add anon policies for tasks

  Allows authenticated clients using anon role to access tasks via RLS checks.
*/

CREATE POLICY "anon_select_tasks"
  ON public.tasks
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = tasks.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_tasks"
  ON public.tasks
  FOR INSERT
  TO anon
  WITH CHECK (
    auth.uid() = created_by
    AND EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = tasks.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_update_tasks"
  ON public.tasks
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = tasks.trip_id
      AND trip_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = tasks.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_delete_tasks"
  ON public.tasks
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.trip_members
      WHERE trip_members.trip_id = tasks.trip_id
      AND trip_members.user_id = auth.uid()
    )
  );
