CREATE TABLE public.treasury_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT current_date,
  direction text NOT NULL DEFAULT 'out',
  amount integer NOT NULL DEFAULT 0,
  counterparty text,
  memo text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treasury_entries TO authenticated;
GRANT SELECT ON public.treasury_entries TO anon;
GRANT ALL ON public.treasury_entries TO service_role;

ALTER TABLE public.treasury_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treasury_select_all" ON public.treasury_entries FOR SELECT USING (true);
CREATE POLICY "treasury_admin_insert" ON public.treasury_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "treasury_admin_update" ON public.treasury_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "treasury_admin_delete" ON public.treasury_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_treasury_entries_updated_at BEFORE UPDATE ON public.treasury_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.monthly_dues
  ADD COLUMN IF NOT EXISTS amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS note text;