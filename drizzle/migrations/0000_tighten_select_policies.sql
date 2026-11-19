DO $$
DECLARE r record;
BEGIN
FOR r IN SELECT * FROM (VALUES
('monthly_dues','Authenticated can read dues'),
('player_comments','Anyone can read player comments'),
('comment_reactions','Authenticated can read reactions'),
('mom_votes','Authenticated can read mom_votes'),
('worst_votes','Authenticated can read worst_votes'),
('treasury_entries','treasury_select_authenticated'),
('match_comments','Anyone can read comments'),
('club_settings','club_settings_read_authenticated'),
('player_fines','Authenticated can view fines'),
('profiles','Authenticated can read profiles'),
('squad_depth','squad_depth_select_all'),
('tactics','Anyone can read tactics'),
('match_predictions','Authenticated can read predictions'),
('match_attendance','Authenticated can read attendance'),
('match_rating_overrides','rating_overrides_select_authenticated')) AS t(tbl,pol)
LOOP
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)', r.pol, r.tbl);
END LOOP;
END $$;