
-- Allow admins to delete results and rosters (needed for CRUD)
CREATE POLICY "Admins can delete results" ON public.results FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete rosters" ON public.rosters FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
