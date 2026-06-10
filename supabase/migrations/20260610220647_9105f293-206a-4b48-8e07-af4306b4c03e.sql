
-- CONTACTS
CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL,
  name text NOT NULL,
  cvr text,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage contacts" ON public.contacts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- LAND LEASES
CREATE TABLE public.land_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaseholder_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  area_ha numeric NOT NULL DEFAULT 0,
  price_per_ha numeric NOT NULL DEFAULT 0,
  annual_fee numeric GENERATED ALWAYS AS (area_ha * price_per_ha) STORED,
  contract_start date,
  contract_end date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.land_leases TO authenticated;
GRANT ALL ON public.land_leases TO service_role;
ALTER TABLE public.land_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage land_leases" ON public.land_leases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BUILDINGS
CREATE TABLE public.buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.buildings TO authenticated;
GRANT ALL ON public.buildings TO service_role;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage buildings" ON public.buildings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BUILDING LEASES
CREATE TABLE public.building_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id uuid REFERENCES public.buildings(id) ON DELETE CASCADE,
  tenant_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  monthly_rent numeric NOT NULL DEFAULT 0,
  deposit numeric DEFAULT 0,
  contract_start date,
  contract_end date,
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.building_leases TO authenticated;
GRANT ALL ON public.building_leases TO service_role;
ALTER TABLE public.building_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage building_leases" ON public.building_leases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STRAW INVENTORY
CREATE TABLE public.straw_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bale_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  price_per_unit numeric NOT NULL DEFAULT 0,
  harvest_year integer,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.straw_inventory TO authenticated;
GRANT ALL ON public.straw_inventory TO service_role;
ALTER TABLE public.straw_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage straw_inventory" ON public.straw_inventory FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- INVOICES (defined before straw_movements due to FK)
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  description text,
  amount_excl_vat numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric GENERATED ALWAYS AS (amount_excl_vat + vat_amount) STORED,
  invoice_date date,
  due_date date,
  status text DEFAULT 'draft',
  dinero_invoice_id text,
  category text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- STRAW MOVEMENTS
CREATE TABLE public.straw_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bale_type text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  direction text NOT NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  total_amount numeric GENERATED ALWAYS AS (quantity * unit_price) STORED,
  movement_date date,
  notes text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.straw_movements TO authenticated;
GRANT ALL ON public.straw_movements TO service_role;
ALTER TABLE public.straw_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage straw_movements" ON public.straw_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FOREST PARCELS
CREATE TABLE public.forest_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area_ha numeric DEFAULT 0,
  tree_species text,
  average_age_years integer,
  estimated_harvest_year_from integer,
  estimated_harvest_year_to integer,
  status text DEFAULT 'growing',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forest_parcels TO authenticated;
GRANT ALL ON public.forest_parcels TO service_role;
ALTER TABLE public.forest_parcels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage forest_parcels" ON public.forest_parcels FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- FOREST ACTIVITIES
CREATE TABLE public.forest_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id uuid REFERENCES public.forest_parcels(id) ON DELETE CASCADE,
  activity_type text NOT NULL,
  volume_m3 numeric,
  quantity_units integer,
  revenue numeric DEFAULT 0,
  cost numeric DEFAULT 0,
  contractor_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  activity_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forest_activities TO authenticated;
GRANT ALL ON public.forest_activities TO service_role;
ALTER TABLE public.forest_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage forest_activities" ON public.forest_activities FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- HUNTING LEASES
CREATE TABLE public.hunting_leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  area_ha numeric DEFAULT 0,
  tenant_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  annual_fee numeric DEFAULT 0,
  contract_start date,
  contract_end date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hunting_leases TO authenticated;
GRANT ALL ON public.hunting_leases TO service_role;
ALTER TABLE public.hunting_leases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage hunting_leases" ON public.hunting_leases FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- HUNTING RECORDS
CREATE TABLE public.hunting_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id uuid REFERENCES public.hunting_leases(id) ON DELETE CASCADE,
  season text,
  species text,
  quota integer,
  harvested integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hunting_records TO authenticated;
GRANT ALL ON public.hunting_records TO service_role;
ALTER TABLE public.hunting_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage hunting_records" ON public.hunting_records FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  description text,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date,
  category text,
  attachment_url text,
  dinero_voucher_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- BUDGETS
CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year integer NOT NULL,
  category text NOT NULL,
  budgeted_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;
GRANT ALL ON public.budgets TO service_role;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage budgets" ON public.budgets FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- DOCUMENTS
CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  file_url text,
  related_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  upload_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage documents" ON public.documents FOR ALL TO authenticated USING (true) WITH CHECK (true);
