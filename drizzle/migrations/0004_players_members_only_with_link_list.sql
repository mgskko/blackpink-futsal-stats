CREATE OR REPLACE FUNCTION public.list_linkable_players()
RETURNS TABLE(id integer, name text, name_en text, back_number integer, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.name, p.name_en, p.back_number, p.is_active
  FROM public.players p
  WHERE auth.uid() IS NOT NULL
    AND COALESCE(p.is_guest, false) = false
  ORDER BY p.name
$$;
REVOKE ALL ON FUNCTION public.list_linkable_players() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_linkable_players() TO authenticated;
DROP POLICY IF EXISTS "Signed-in users can read players" ON public.players;
CREATE POLICY "Members can read players" ON public.players FOR SELECT TO authenticated USING (public.is_club_member(auth.uid()) OR public.has_role(auth.uid(),'admin'));