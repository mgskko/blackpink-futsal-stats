DROP POLICY IF EXISTS treasury_select_all ON public.treasury_entries;
CREATE POLICY treasury_select_authenticated ON public.treasury_entries FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.treasury_entries FROM anon;

DROP POLICY IF EXISTS club_settings_read ON public.club_settings;
CREATE POLICY club_settings_read_authenticated ON public.club_settings FOR SELECT TO authenticated USING (true);
REVOKE SELECT ON public.club_settings FROM anon;