ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS height_m numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS roof_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS roof_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS wall_color text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS map_angle numeric DEFAULT NULL;

CREATE TABLE IF NOT EXISTS public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_background_url text DEFAULT NULL,
  map_background_opacity numeric NOT NULL DEFAULT 0.55,
  map_scale_m_per_px numeric DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to site_settings"
  ON public.site_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_site_settings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS site_settings_updated_at ON public.site_settings;
CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_site_settings_updated_at();

INSERT INTO public.site_settings (id, map_background_url, map_background_opacity)
SELECT gen_random_uuid(), NULL, 0.55
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings);