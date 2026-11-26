DROP POLICY IF EXISTS "Members can read players" ON public.players;
CREATE POLICY "Signed-in users can read players" ON public.players FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);