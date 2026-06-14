
CREATE TABLE public.field_parcels (
  field_id uuid NOT NULL REFERENCES public.fields(id) ON DELETE CASCADE,
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (field_id, parcel_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.field_parcels TO authenticated;
GRANT ALL ON public.field_parcels TO service_role;
ALTER TABLE public.field_parcels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read field_parcels" ON public.field_parcels
  FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert field_parcels" ON public.field_parcels
  FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can delete field_parcels" ON public.field_parcels
  FOR DELETE TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete field_parcels" ON public.field_parcels
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_field_parcels_parcel_id ON public.field_parcels(parcel_id);

INSERT INTO public.field_parcels (field_id, parcel_id)
SELECT field_id, id FROM public.parcels WHERE field_id IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.parcels DROP COLUMN field_id;
