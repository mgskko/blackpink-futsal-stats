CREATE TABLE public.match_rating_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id integer NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rating numeric(4,2) NOT NULL CHECK (rating >= 0 AND rating <= 10),
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_rating_overrides TO authenticated;
GRANT ALL ON public.match_rating_overrides TO service_role;

ALTER TABLE public.match_rating_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rating_overrides_select_authenticated"
  ON public.match_rating_overrides FOR SELECT TO authenticated USING (true);

CREATE POLICY "rating_overrides_insert_admin"
  ON public.match_rating_overrides FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rating_overrides_update_admin"
  ON public.match_rating_overrides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "rating_overrides_delete_admin"
  ON public.match_rating_overrides FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_match_rating_overrides_updated_at
  BEFORE UPDATE ON public.match_rating_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();