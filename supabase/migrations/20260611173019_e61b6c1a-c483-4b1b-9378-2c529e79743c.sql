CREATE TABLE public.maintenance_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  building_id uuid REFERENCES public.buildings(id) ON DELETE SET NULL,
  assigned_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  due_date date,
  completed_date date,
  estimated_cost numeric(12,2),
  actual_cost numeric(12,2),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_tasks TO authenticated;
GRANT ALL ON public.maintenance_tasks TO service_role;

ALTER TABLE public.maintenance_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view maintenance_tasks"
  ON public.maintenance_tasks FOR SELECT TO authenticated
  USING (public.is_member(auth.uid()));

CREATE POLICY "Members can insert maintenance_tasks"
  ON public.maintenance_tasks FOR INSERT TO authenticated
  WITH CHECK (public.is_member(auth.uid()));

CREATE POLICY "Members can update maintenance_tasks"
  ON public.maintenance_tasks FOR UPDATE TO authenticated
  USING (public.is_member(auth.uid()))
  WITH CHECK (public.is_member(auth.uid()));

CREATE POLICY "Admins can delete maintenance_tasks"
  ON public.maintenance_tasks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.update_maintenance_tasks_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_maintenance_tasks_updated_at
  BEFORE UPDATE ON public.maintenance_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();

CREATE INDEX idx_maintenance_tasks_status ON public.maintenance_tasks(status);
CREATE INDEX idx_maintenance_tasks_due_date ON public.maintenance_tasks(due_date);
CREATE INDEX idx_maintenance_tasks_building_id ON public.maintenance_tasks(building_id);