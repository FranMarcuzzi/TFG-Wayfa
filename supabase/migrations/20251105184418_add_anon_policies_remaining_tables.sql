/*
  # Add Anon Policies for Remaining Tables

  ## Problem
  The Supabase client uses the anon role even for authenticated users.
  We need anon policies for all tables.

  ## Tables to update
  - trip_members (add missing policies)
  - days
  - activities  
  - polls
  - poll_options
  - poll_votes
  - messages

  ## Changes
  Add comprehensive anon policies for all operations
*/

-- ============================================================================
-- DAYS
-- ============================================================================

CREATE POLICY "anon_select_days"
  ON public.days
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = days.trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_days"
  ON public.days
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_update_days"
  ON public.days
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_delete_days"
  ON public.days
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- ACTIVITIES
-- ============================================================================

CREATE POLICY "anon_select_activities"
  ON public.activities
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM days d
      JOIN trips t ON t.id = d.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE d.id = activities.day_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_activities"
  ON public.activities
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM days d
      JOIN trips t ON t.id = d.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE d.id = day_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_update_activities"
  ON public.activities
  FOR UPDATE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM days d
      JOIN trips t ON t.id = d.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE d.id = day_id
        AND tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM days d
      JOIN trips t ON t.id = d.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE d.id = day_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_delete_activities"
  ON public.activities
  FOR DELETE
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM days d
      JOIN trips t ON t.id = d.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE d.id = day_id
        AND tm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- POLLS
-- ============================================================================

CREATE POLICY "anon_select_polls"
  ON public.polls
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = polls.trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_polls"
  ON public.polls
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY "anon_update_polls"
  ON public.polls
  FOR UPDATE
  TO anon
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "anon_delete_polls"
  ON public.polls
  FOR DELETE
  TO anon
  USING (created_by = auth.uid());

-- ============================================================================
-- POLL_OPTIONS
-- ============================================================================

CREATE POLICY "anon_select_poll_options"
  ON public.poll_options
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM polls p
      JOIN trips t ON t.id = p.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE p.id = poll_options.poll_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_poll_options"
  ON public.poll_options
  FOR INSERT
  TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM polls p
      WHERE p.id = poll_id AND p.created_by = auth.uid()
    )
  );

-- ============================================================================
-- POLL_VOTES
-- ============================================================================

CREATE POLICY "anon_select_poll_votes"
  ON public.poll_votes
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM poll_options po
      JOIN polls p ON p.id = po.poll_id
      JOIN trips t ON t.id = p.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE po.id = poll_votes.option_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_poll_votes"
  ON public.poll_votes
  FOR INSERT
  TO anon
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM poll_options po
      JOIN polls p ON p.id = po.poll_id
      JOIN trips t ON t.id = p.trip_id
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE po.id = option_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_delete_poll_votes"
  ON public.poll_votes
  FOR DELETE
  TO anon
  USING (user_id = auth.uid());

-- ============================================================================
-- MESSAGES
-- ============================================================================

CREATE POLICY "anon_select_messages"
  ON public.messages
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = messages.trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_insert_messages"
  ON public.messages
  FOR INSERT
  TO anon
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM trips t
      JOIN trip_members tm ON tm.trip_id = t.id
      WHERE t.id = trip_id
        AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "anon_update_messages"
  ON public.messages
  FOR UPDATE
  TO anon
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "anon_delete_messages"
  ON public.messages
  FOR DELETE
  TO anon
  USING (author_id = auth.uid());
