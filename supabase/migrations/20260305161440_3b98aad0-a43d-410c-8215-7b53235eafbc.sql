
CREATE TABLE public.player_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.player_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read player comments" ON public.player_comments FOR SELECT USING (true);
CREATE POLICY "Auth users can insert player comments" ON public.player_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own player comments" ON public.player_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete any player comment" ON public.player_comments FOR DELETE USING (has_role(auth.uid(), 'admin'));
