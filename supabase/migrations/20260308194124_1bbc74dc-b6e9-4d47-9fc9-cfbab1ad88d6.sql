
CREATE TABLE public.worst_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES matches(id),
  voted_player_id integer NOT NULL REFERENCES players(id),
  voter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.worst_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read worst_votes" ON public.worst_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can insert worst_votes" ON public.worst_votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Users can update own worst_votes" ON public.worst_votes FOR UPDATE USING (auth.uid() = voter_id);
CREATE POLICY "Users can delete own worst_votes" ON public.worst_votes FOR DELETE USING (auth.uid() = voter_id);
