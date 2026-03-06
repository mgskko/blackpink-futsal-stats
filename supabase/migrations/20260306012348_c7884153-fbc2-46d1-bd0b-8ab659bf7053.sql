
ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS assist_type text;
ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS goal_type text;
ALTER TABLE goal_events ADD COLUMN IF NOT EXISTS build_up_process text;

CREATE TABLE IF NOT EXISTS match_quarters (
  id serial PRIMARY KEY,
  match_id integer NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  quarter integer NOT NULL,
  score_for integer DEFAULT 0,
  score_against integer DEFAULT 0,
  lineup jsonb,
  UNIQUE(match_id, quarter)
);

ALTER TABLE match_quarters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read match_quarters" ON match_quarters FOR SELECT USING (true);
CREATE POLICY "Admins can insert match_quarters" ON match_quarters FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update match_quarters" ON match_quarters FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete match_quarters" ON match_quarters FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));
