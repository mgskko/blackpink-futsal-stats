
-- MOM Votes table for anonymous Man of the Match voting
CREATE TABLE public.mom_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  voted_player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, voter_id)
);

ALTER TABLE public.mom_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read mom votes
CREATE POLICY "Anyone can read mom_votes" ON public.mom_votes FOR SELECT USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "Auth users can insert mom_votes" ON public.mom_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = voter_id);

-- Users can update their own vote
CREATE POLICY "Users can update own mom_votes" ON public.mom_votes FOR UPDATE TO authenticated USING (auth.uid() = voter_id);

-- Users can delete their own vote
CREATE POLICY "Users can delete own mom_votes" ON public.mom_votes FOR DELETE TO authenticated USING (auth.uid() = voter_id);
