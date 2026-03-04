
-- Attendance table for tracking player attendance per match
CREATE TABLE public.match_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'undecided' CHECK (status IN ('attending', 'absent', 'undecided')),
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);

ALTER TABLE public.match_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read attendance" ON public.match_attendance FOR SELECT USING (true);
CREATE POLICY "Admins can insert attendance" ON public.match_attendance FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update attendance" ON public.match_attendance FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete attendance" ON public.match_attendance FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for attendance
ALTER PUBLICATION supabase_realtime ADD TABLE public.match_attendance;

-- Monthly dues table
CREATE TABLE public.monthly_dues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  year_month text NOT NULL, -- format: '2026-03'
  is_paid boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, year_month)
);

ALTER TABLE public.monthly_dues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read dues" ON public.monthly_dues FOR SELECT USING (true);
CREATE POLICY "Admins can insert dues" ON public.monthly_dues FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update dues" ON public.monthly_dues FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete dues" ON public.monthly_dues FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Add sequences for auto-incrementing IDs on matches, teams, results, goal_events, rosters
CREATE SEQUENCE IF NOT EXISTS matches_id_seq;
SELECT setval('matches_id_seq', COALESCE((SELECT MAX(id) FROM matches), 0) + 1);
ALTER TABLE matches ALTER COLUMN id SET DEFAULT nextval('matches_id_seq');

CREATE SEQUENCE IF NOT EXISTS teams_id_seq;
SELECT setval('teams_id_seq', COALESCE((SELECT MAX(id) FROM teams), 0) + 1);
ALTER TABLE teams ALTER COLUMN id SET DEFAULT nextval('teams_id_seq');

CREATE SEQUENCE IF NOT EXISTS results_id_seq;
SELECT setval('results_id_seq', COALESCE((SELECT MAX(id) FROM results), 0) + 1);
ALTER TABLE results ALTER COLUMN id SET DEFAULT nextval('results_id_seq');

CREATE SEQUENCE IF NOT EXISTS goal_events_id_seq;
SELECT setval('goal_events_id_seq', COALESCE((SELECT MAX(id) FROM goal_events), 0) + 1);
ALTER TABLE goal_events ALTER COLUMN id SET DEFAULT nextval('goal_events_id_seq');

CREATE SEQUENCE IF NOT EXISTS rosters_id_seq;
SELECT setval('rosters_id_seq', COALESCE((SELECT MAX(id) FROM rosters), 0) + 1);
ALTER TABLE rosters ALTER COLUMN id SET DEFAULT nextval('rosters_id_seq');
