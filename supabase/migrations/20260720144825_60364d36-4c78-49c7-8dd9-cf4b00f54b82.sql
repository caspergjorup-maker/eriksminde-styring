
-- Budget scenarios
CREATE TABLE public.budget_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  year integer NOT NULL,
  notes text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_scenarios TO authenticated;
GRANT ALL ON public.budget_scenarios TO service_role;
ALTER TABLE public.budget_scenarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read scenarios" ON public.budget_scenarios FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "members insert scenarios" ON public.budget_scenarios FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update scenarios" ON public.budget_scenarios FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members delete scenarios" ON public.budget_scenarios FOR DELETE TO authenticated USING (public.is_member(auth.uid()));

-- Budget lines
CREATE TABLE public.budget_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.budget_scenarios(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('income','expense')),
  category text NOT NULL,
  label text NOT NULL,
  annual_amount numeric NOT NULL DEFAULT 0,
  monthly_override jsonb,
  source_note text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX budget_lines_scenario_idx ON public.budget_lines(scenario_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_lines TO authenticated;
GRANT ALL ON public.budget_lines TO service_role;
ALTER TABLE public.budget_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read lines" ON public.budget_lines FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "members insert lines" ON public.budget_lines FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update lines" ON public.budget_lines FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members delete lines" ON public.budget_lines FOR DELETE TO authenticated USING (public.is_member(auth.uid()));

-- Budget loans
CREATE TABLE public.budget_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid NOT NULL REFERENCES public.budget_scenarios(id) ON DELETE CASCADE,
  name text NOT NULL,
  principal numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0, -- annual, decimal e.g. 0.0496
  term_months integer NOT NULL DEFAULT 0,
  loan_type text NOT NULL DEFAULT 'annuity' CHECK (loan_type IN ('annuity','interest_only','standing')),
  start_date date,
  notes text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX budget_loans_scenario_idx ON public.budget_loans(scenario_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_loans TO authenticated;
GRANT ALL ON public.budget_loans TO service_role;
ALTER TABLE public.budget_loans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read loans" ON public.budget_loans FOR SELECT TO authenticated USING (public.is_member(auth.uid()));
CREATE POLICY "members insert loans" ON public.budget_loans FOR INSERT TO authenticated WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members update loans" ON public.budget_loans FOR UPDATE TO authenticated USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));
CREATE POLICY "members delete loans" ON public.budget_loans FOR DELETE TO authenticated USING (public.is_member(auth.uid()));

-- updated_at trigger fn (reuse if exists)
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER budget_scenarios_updated BEFORE UPDATE ON public.budget_scenarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER budget_lines_updated BEFORE UPDATE ON public.budget_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER budget_loans_updated BEFORE UPDATE ON public.budget_loans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
