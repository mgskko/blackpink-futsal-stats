DROP POLICY IF EXISTS "Users can update own comments" ON public.match_comments;
CREATE POLICY "Users can update own comments" ON public.match_comments FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own predictions" ON public.match_predictions;
CREATE POLICY "Users can update own predictions" ON public.match_predictions FOR UPDATE TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "Users can update own mom_votes" ON public.mom_votes;
CREATE POLICY "Users can update own mom_votes" ON public.mom_votes FOR UPDATE TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "Users can update own worst_votes" ON public.worst_votes;
CREATE POLICY "Users can update own worst_votes" ON public.worst_votes FOR UPDATE TO authenticated USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);