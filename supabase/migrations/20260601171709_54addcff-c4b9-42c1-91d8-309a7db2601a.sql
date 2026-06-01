
-- Restrict public SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can read attendance" ON public.match_attendance;
CREATE POLICY "Authenticated can read attendance" ON public.match_attendance FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read predictions" ON public.match_predictions;
CREATE POLICY "Authenticated can read predictions" ON public.match_predictions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read mom_votes" ON public.mom_votes;
CREATE POLICY "Authenticated can read mom_votes" ON public.mom_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read worst_votes" ON public.worst_votes;
CREATE POLICY "Authenticated can read worst_votes" ON public.worst_votes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read reactions" ON public.comment_reactions;
CREATE POLICY "Authenticated can read reactions" ON public.comment_reactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read dues" ON public.monthly_dues;
CREATE POLICY "Authenticated can read dues" ON public.monthly_dues FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;
CREATE POLICY "Authenticated can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);

-- Revoke anon SELECT privileges (RLS already blocks, but removes Data API access entirely)
REVOKE SELECT ON public.match_attendance, public.match_predictions, public.mom_votes,
  public.worst_votes, public.comment_reactions, public.monthly_dues, public.profiles FROM anon;
