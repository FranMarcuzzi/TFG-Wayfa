/*
  # Create User Profiles Table

  1. New Table
    - `user_profiles`
      - `user_id` (uuid, primary key, references auth.users)
      - `email` (text, not null)
      - `display_name` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Indexes
    - Index on email for fast lookup

  3. Trigger
    - Automatically create profile when user signs up

  4. Security
    - RLS disabled (auth.uid() doesn't work in this project)
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index on email
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- Disable RLS
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;

-- Create trigger function to auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', SPLIT_PART(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (if not exists)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing users (get from trip_members)
INSERT INTO public.user_profiles (user_id, email, display_name)
SELECT DISTINCT 
  tm.user_id,
  'user-' || SUBSTRING(tm.user_id::text, 1, 8) || '@example.com' as email,
  'User ' || SUBSTRING(tm.user_id::text, 1, 8) as display_name
FROM public.trip_members tm
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_profiles up WHERE up.user_id = tm.user_id
)
ON CONFLICT (user_id) DO NOTHING;

-- Add comment
COMMENT ON TABLE public.user_profiles IS 'User profile information. Auto-created on signup. RLS disabled.';
