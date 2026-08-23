CREATE TABLE public.club_settings (
  key text PRIMARY KEY,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.club_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_settings TO authenticated;
GRANT ALL ON public.club_settings TO service_role;
ALTER TABLE public.club_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "club_settings_read" ON public.club_settings FOR SELECT USING (true);
CREATE POLICY "club_settings_admin_write" ON public.club_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_club_settings_updated_at BEFORE UPDATE ON public.club_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();