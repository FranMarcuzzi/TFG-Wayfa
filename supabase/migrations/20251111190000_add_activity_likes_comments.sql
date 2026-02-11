/*
  # Add activity likes and comments

  - activity_likes: per-user like for an activity
  - activity_comments: comments on an activity
  - Disable RLS to match current project policy
*/

-- activity_likes
CREATE TABLE IF NOT EXISTS public.activity_likes (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (activity_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_likes_activity ON public.activity_likes(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_likes_user ON public.activity_likes(user_id);
ALTER TABLE public.activity_likes DISABLE ROW LEVEL SECURITY;
-- activity_comments
CREATE TABLE IF NOT EXISTS public.activity_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_comments_activity ON public.activity_comments(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_user ON public.activity_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_comments_created_at ON public.activity_comments(created_at);
ALTER TABLE public.activity_comments DISABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.activity_likes IS 'Per-user likes on activities. RLS disabled in this project.';
COMMENT ON TABLE public.activity_comments IS 'Comments on activities. RLS disabled in this project.';
