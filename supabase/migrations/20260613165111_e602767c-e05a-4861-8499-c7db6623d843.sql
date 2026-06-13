CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  assigned_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  category text,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  due_date date,
  completed_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view tasks" ON public.tasks FOR SELECT USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert tasks" ON public.tasks FOR INSERT WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update tasks" ON public.tasks FOR UPDATE USING (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete tasks" ON public.tasks FOR DELETE USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.update_maintenance_tasks_updated_at();