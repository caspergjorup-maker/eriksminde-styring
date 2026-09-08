ALTER TABLE public.buildings DROP CONSTRAINT IF EXISTS buildings_lease_status_check;
ALTER TABLE public.buildings ADD CONSTRAINT buildings_lease_status_check CHECK (lease_status IS NULL OR lease_status IN ('udlejet','ledig','intern_brug'));
ALTER TABLE public.building_units DROP CONSTRAINT IF EXISTS building_units_lease_status_check;
ALTER TABLE public.building_units ADD CONSTRAINT building_units_lease_status_check CHECK (lease_status IS NULL OR lease_status IN ('udlejet','ledig','intern_brug'));