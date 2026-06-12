
-- ============ MACHINES ============
CREATE TABLE public.machines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('traktor','rendegraver','laesser','anhaenger','plov','saemaskine','sproejtevogn','andet')),
  brand text,
  model text,
  year integer,
  serial_number text,
  registration_number text,
  ownership text DEFAULT 'eget' CHECK (ownership IN ('eget','leaset','lejet')),
  status text DEFAULT 'i_drift' CHECK (status IN ('i_drift','reparation','udgaaet')),
  current_hours integer,
  last_service_date date,
  last_service_hours integer,
  next_service_date date,
  next_service_hours integer,
  service_interval_hours integer,
  service_interval_months integer,
  estimated_value numeric,
  insurance_company text,
  insurance_expiry date,
  lease_expiry date,
  preferred_supplier_id uuid REFERENCES public.contacts(id),
  image_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT ALL ON public.machines TO service_role;

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view machines" ON public.machines
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert machines" ON public.machines
  FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update machines" ON public.machines
  FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete machines" ON public.machines
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_machines_updated_at
  BEFORE UPDATE ON public.machines
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();

-- ============ SERVICE LOGS ============
CREATE TABLE public.service_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_id uuid NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  service_date date NOT NULL,
  hours_at_service integer,
  description text,
  cost numeric,
  supplier_id uuid REFERENCES public.contacts(id),
  next_service_date date,
  next_service_hours integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_logs TO authenticated;
GRANT ALL ON public.service_logs TO service_role;

ALTER TABLE public.service_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view service logs" ON public.service_logs
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert service logs" ON public.service_logs
  FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update service logs" ON public.service_logs
  FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete service logs" ON public.service_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ============ MAINTENANCE TASKS ============
ALTER TABLE public.maintenance_tasks
  ADD COLUMN IF NOT EXISTS machine_id uuid REFERENCES public.machines(id),
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS estimated_cost numeric,
  ADD COLUMN IF NOT EXISTS actual_cost numeric;

ALTER TABLE public.maintenance_tasks
  ADD CONSTRAINT check_building_or_machine CHECK (
    (building_id IS NOT NULL AND machine_id IS NULL) OR
    (machine_id IS NOT NULL AND building_id IS NULL) OR
    (building_id IS NULL AND machine_id IS NULL)
  );

-- ============ BUILDINGS ============
ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS preferred_supplier_id uuid REFERENCES public.contacts(id);

-- ============ SEED ============
INSERT INTO public.machines (name, type, status, ownership) VALUES
  ('Traktor',     'traktor',     'i_drift', 'eget'),
  ('Rendegraver', 'rendegraver', 'i_drift', 'eget');
