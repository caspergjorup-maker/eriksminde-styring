
CREATE TABLE public.fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  use_type text CHECK (use_type IN ('omdrift','skov','gaard')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fields TO authenticated;
GRANT ALL ON public.fields TO service_role;

ALTER TABLE public.fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view fields" ON public.fields
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert fields" ON public.fields
  FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update fields" ON public.fields
  FOR UPDATE TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete fields" ON public.fields
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS field_id uuid REFERENCES public.fields(id) ON DELETE SET NULL;

INSERT INTO public.fields (id, name, use_type) VALUES
  ('f1000000-0000-0000-0000-000000000001','Nordmark','omdrift'),
  ('f1000000-0000-0000-0000-000000000002','Vestmark','omdrift'),
  ('f1000000-0000-0000-0000-000000000003','Østmark','omdrift'),
  ('f1000000-0000-0000-0000-000000000004','Sydmark','omdrift'),
  ('f1000000-0000-0000-0000-000000000005','Nordskov','skov'),
  ('f1000000-0000-0000-0000-000000000006','Sønderlund','skov'),
  ('f1000000-0000-0000-0000-000000000007','Gårdsareal','gaard');

UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000001' WHERE matrikel_id = '57';
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000002' WHERE matrikel_id IN ('2cf','2g');
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000003' WHERE matrikel_id IN ('2cb','2a');
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000004' WHERE matrikel_id = '2cc';
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000005' WHERE matrikel_id = '1m';
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000006' WHERE matrikel_id IN ('58','2cd');
UPDATE public.parcels SET field_id = 'f1000000-0000-0000-0000-000000000007' WHERE matrikel_id IN ('3i','45b');
