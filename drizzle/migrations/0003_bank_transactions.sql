CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booked_date date NOT NULL,
  text text NOT NULL,
  amount numeric NOT NULL,
  balance numeric,
  kind text CHECK (kind IN ('income','expense','capital')),
  category text,
  dedupe_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transactions TO authenticated;
GRANT ALL ON public.bank_transactions TO service_role;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members all bank_transactions" ON public.bank_transactions FOR ALL TO authenticated
  USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));

CREATE TABLE public.bank_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('income','expense','capital')),
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_rules TO authenticated;
GRANT ALL ON public.bank_rules TO service_role;
ALTER TABLE public.bank_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members all bank_rules" ON public.bank_rules FOR ALL TO authenticated
  USING (public.is_member(auth.uid())) WITH CHECK (public.is_member(auth.uid()));