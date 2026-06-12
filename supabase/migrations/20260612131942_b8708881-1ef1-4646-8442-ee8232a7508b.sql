
CREATE TABLE IF NOT EXISTS public.parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrikel_id text NOT NULL,
  ejerlav text NOT NULL DEFAULT 'Harre By, Harre',
  use_type text CHECK (use_type IN ('omdrift','skov','gaard')),
  net_area_ha numeric,
  land_lease_id uuid REFERENCES public.land_leases(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (matrikel_id, ejerlav)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parcels TO authenticated;
GRANT ALL ON public.parcels TO service_role;

ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read parcels" ON public.parcels
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins can insert parcels" ON public.parcels
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update parcels" ON public.parcels
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete parcels" ON public.parcels
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_parcels_updated_at
  BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();
