ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(document_id, entity_type, entity_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_links TO authenticated;
GRANT ALL ON public.document_links TO service_role;

ALTER TABLE public.document_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read document links" ON public.document_links FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "Members can insert document links" ON public.document_links FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Members can update document links" ON public.document_links FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "Admins can delete document links" ON public.document_links FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS update_document_links_updated_at ON public.document_links;
CREATE TRIGGER update_document_links_updated_at
BEFORE UPDATE ON public.document_links
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();