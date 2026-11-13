DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_members" ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id OR public.is_member(auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated full access to site_settings" ON public.site_settings;
CREATE POLICY "site_settings_members_all" ON public.site_settings FOR ALL TO authenticated
USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));