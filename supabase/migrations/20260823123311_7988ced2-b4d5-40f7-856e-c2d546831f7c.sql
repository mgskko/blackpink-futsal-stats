CREATE TABLE public.squad_depth (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_code text NOT NULL,
  player_id integer REFERENCES public.players(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.squad_depth TO authenticated;
GRANT SELECT ON public.squad_depth TO anon;
GRANT ALL ON public.squad_depth TO service_role;

ALTER TABLE public.squad_depth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "squad_depth_select_all" ON public.squad_depth FOR SELECT USING (true);
CREATE POLICY "squad_depth_admin_insert" ON public.squad_depth FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "squad_depth_admin_update" ON public.squad_depth FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "squad_depth_admin_delete" ON public.squad_depth FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_squad_depth_updated_at BEFORE UPDATE ON public.squad_depth FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();