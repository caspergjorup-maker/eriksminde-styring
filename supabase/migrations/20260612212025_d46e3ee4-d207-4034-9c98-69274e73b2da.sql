
CREATE TABLE public.building_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  area_m2 numeric,
  lease_status text DEFAULT 'ledig' CHECK (lease_status IN ('udlejet','ledig','ikke_klar','intern_brug','udlejes_ikke')),
  lease_status_note text,
  estimated_monthly_rent numeric,
  has_electricity boolean,
  has_water boolean,
  has_heating boolean,
  heating_type text,
  has_sewage boolean,
  has_internet boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_units TO authenticated;
GRANT ALL ON public.building_units TO service_role;

ALTER TABLE public.building_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view units" ON public.building_units
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert units" ON public.building_units
  FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update units" ON public.building_units
  FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete units" ON public.building_units
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_building_units_updated_at
  BEFORE UPDATE ON public.building_units
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();

ALTER TABLE public.building_leases
  ADD COLUMN IF NOT EXISTS unit_id uuid REFERENCES public.building_units(id) ON DELETE SET NULL;

-- Seed units for the five subdivided buildings
INSERT INTO public.building_units (building_id, name, lease_status)
SELECT id, 'Østlig del', 'ledig' FROM public.buildings WHERE name = 'Østlænge'
UNION ALL
SELECT id, 'Vestlig del', 'ledig' FROM public.buildings WHERE name = 'Østlænge'
UNION ALL
SELECT id, 'Nordlig del', 'ledig' FROM public.buildings WHERE name = 'Stald 1'
UNION ALL
SELECT id, 'Sydlig del', 'ledig' FROM public.buildings WHERE name = 'Stald 1'
UNION ALL
SELECT id, 'Nordlig del', 'ledig' FROM public.buildings WHERE name = 'Stald 3'
UNION ALL
SELECT id, 'Sydlig del', 'ledig' FROM public.buildings WHERE name = 'Stald 3'
UNION ALL
SELECT id, 'Østlig del', 'ledig' FROM public.buildings WHERE name = 'Værksted'
UNION ALL
SELECT id, 'Vestlig del', 'ledig' FROM public.buildings WHERE name = 'Værksted'
UNION ALL
SELECT id, 'Østlig del', 'ledig' FROM public.buildings WHERE name = 'Tørreri'
UNION ALL
SELECT id, 'Vestlig del', 'ledig' FROM public.buildings WHERE name = 'Tørreri';
