CREATE TABLE public.player_fines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id integer NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  fine_type text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  match_date date,
  is_waived boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT false,
  note text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_fines TO authenticated;
GRANT ALL ON public.player_fines TO service_role;

ALTER TABLE public.player_fines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view fines" ON public.player_fines
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert fines" ON public.player_fines
FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update fines" ON public.player_fines
FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete fines" ON public.player_fines
FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_player_fines_updated_at
BEFORE UPDATE ON public.player_fines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();