ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS lease_area_ha        numeric,
  ADD COLUMN IF NOT EXISTS lease_price_per_ha   numeric,
  ADD COLUMN IF NOT EXISTS soil_type            text,
  ADD COLUMN IF NOT EXISTS is_drained           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_irrigation       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS eligible_area_ha     numeric,
  ADD COLUMN IF NOT EXISTS non_eligible_area_ha numeric,
  ADD COLUMN IF NOT EXISTS notes                text;