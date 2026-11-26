CREATE OR REPLACE FUNCTION public.is_club_member(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND player_id IS NOT NULL)
      OR public.has_role(_user_id, 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_club_member(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.is_club_member(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Anyone can read player comments" ON public.player_comments;
CREATE POLICY "Members can read player comments" ON public.player_comments FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can read reactions" ON public.comment_reactions;
CREATE POLICY "Members can read reactions" ON public.comment_reactions FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "treasury_select_authenticated" ON public.treasury_entries;
CREATE POLICY "treasury_select_members" ON public.treasury_entries FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "Anyone can read comments" ON public.match_comments;
CREATE POLICY "Members can read comments" ON public.match_comments FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "Authenticated can view fines" ON public.player_fines;
CREATE POLICY "Members can view fines" ON public.player_fines FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "Anyone can read tactics" ON public.tactics;
CREATE POLICY "Members can read tactics" ON public.tactics FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));
DROP POLICY IF EXISTS "rating_overrides_select_authenticated" ON public.match_rating_overrides;
CREATE POLICY "rating_overrides_select_members" ON public.match_rating_overrides FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()));