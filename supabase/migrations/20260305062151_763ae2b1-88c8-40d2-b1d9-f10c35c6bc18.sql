
-- Match comments table
CREATE TABLE public.match_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  is_system boolean NOT NULL DEFAULT false,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.match_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read comments" ON public.match_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert comments" ON public.match_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.match_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.match_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert system comments" ON public.match_comments FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete any comment" ON public.match_comments FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Comment reactions table
CREATE TABLE public.comment_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.match_comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions" ON public.comment_reactions FOR SELECT USING (true);
CREATE POLICY "Auth users can insert reactions" ON public.comment_reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own reactions" ON public.comment_reactions FOR DELETE USING (auth.uid() = user_id);

-- Add nickname and equipped_title to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nickname text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS equipped_title text;
