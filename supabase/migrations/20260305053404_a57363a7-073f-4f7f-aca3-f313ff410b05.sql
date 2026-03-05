
-- Match predictions table for toto system
CREATE TABLE public.match_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL,
  prediction text NOT NULL CHECK (prediction IN ('win', 'draw', 'loss')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, voter_id)
);

ALTER TABLE public.match_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read predictions" ON public.match_predictions FOR SELECT USING (true);
CREATE POLICY "Auth users can insert predictions" ON public.match_predictions FOR INSERT WITH CHECK (auth.uid() = voter_id);
CREATE POLICY "Users can update own predictions" ON public.match_predictions FOR UPDATE USING (auth.uid() = voter_id);
CREATE POLICY "Users can delete own predictions" ON public.match_predictions FOR DELETE USING (auth.uid() = voter_id);

-- Enable realtime for predictions
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_predictions;
