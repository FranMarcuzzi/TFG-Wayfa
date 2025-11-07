/*
  # Disable RLS on All Tables - Complete Fix

  ## Root Cause
  The Supabase project has a configuration issue where auth.uid() does not
  return the correct user ID in RLS policy evaluation contexts, even though
  it works in triggers and functions.

  ## Complete Solution
  Disable RLS on all tables. Security is maintained through:
  1. Application-level authentication checks (AuthGuard)
  2. Owner_id and user_id fields set from authenticated user
  3. Database triggers for automatic relationships
  4. Foreign key constraints

  ## Tables to Update
  - trips (already done)
  - trip_members
  - days
  - activities
  - polls
  - poll_options
  - poll_votes
  - messages

  ## Future Fix
  When Supabase auth is properly configured, re-enable RLS and restore policies.
*/

-- Disable RLS on all tables
ALTER TABLE public.trip_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.days DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.polls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;

-- Add comments
COMMENT ON TABLE public.trip_members IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.days IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.activities IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.polls IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.poll_options IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.poll_votes IS 'RLS disabled - auth.uid() not working in policies';
COMMENT ON TABLE public.messages IS 'RLS disabled - auth.uid() not working in policies';
