CREATE TABLE public.tactics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  summary text,
  formation text,
  roles jsonb DEFAULT '[]'::jsonb,
  steps jsonb DEFAULT '[]'::jsonb,
  warnings jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  sort_order integer DEFAULT 0
);

ALTER TABLE public.tactics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tactics" ON public.tactics FOR SELECT USING (true);
CREATE POLICY "Admins can insert tactics" ON public.tactics FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update tactics" ON public.tactics FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete tactics" ON public.tactics FOR DELETE USING (has_role(auth.uid(), 'admin'));