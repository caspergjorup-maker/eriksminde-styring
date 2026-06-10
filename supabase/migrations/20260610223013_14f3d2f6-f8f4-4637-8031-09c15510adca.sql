
-- 1. Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

-- 2. user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: any role at all (admin OR member)
CREATE OR REPLACE FUNCTION public.is_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin','member')
  )
$$;

-- 4. RLS on user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5. Auto-assign first signup as admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Replace policies on every data table with member-gated policies
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'budgets','building_leases','buildings','contacts','documents','expenses',
    'forest_activities','forest_parcels','hunting_leases','hunting_records',
    'invoices','land_leases','straw_inventory','straw_movements'
  ];
  polname text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- drop all existing policies on table
    FOR polname IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', polname, t);
    END LOOP;

    -- members (incl. admins) can read
    EXECUTE format($p$
      CREATE POLICY "Members can read %1$s"
      ON public.%1$I FOR SELECT TO authenticated
      USING (public.is_member(auth.uid()))
    $p$, t);

    -- members can insert
    EXECUTE format($p$
      CREATE POLICY "Members can insert %1$s"
      ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (public.is_member(auth.uid()))
    $p$, t);

    -- members can update
    EXECUTE format($p$
      CREATE POLICY "Members can update %1$s"
      ON public.%1$I FOR UPDATE TO authenticated
      USING (public.is_member(auth.uid()))
      WITH CHECK (public.is_member(auth.uid()))
    $p$, t);

    -- only admins can delete
    EXECUTE format($p$
      CREATE POLICY "Admins can delete %1$s"
      ON public.%1$I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'))
    $p$, t);
  END LOOP;
END $$;
