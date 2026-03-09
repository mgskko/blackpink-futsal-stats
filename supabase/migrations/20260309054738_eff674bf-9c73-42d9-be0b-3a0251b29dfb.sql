
-- Team history table for clubhouse
CREATE TABLE public.team_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL, -- 'logo', 'uniform', 'milestone'
  title text NOT NULL,
  description text,
  year integer,
  image_url text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

ALTER TABLE public.team_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read team_history" ON public.team_history FOR SELECT USING (true);
CREATE POLICY "Admins can insert team_history" ON public.team_history FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update team_history" ON public.team_history FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete team_history" ON public.team_history FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for team history images
INSERT INTO storage.buckets (id, name, public) VALUES ('team-history', 'team-history', true);

CREATE POLICY "Anyone can read team-history" ON storage.objects FOR SELECT USING (bucket_id = 'team-history');
CREATE POLICY "Admins can upload team-history" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team-history' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete team-history" ON storage.objects FOR DELETE USING (bucket_id = 'team-history' AND has_role(auth.uid(), 'admin'::app_role));
