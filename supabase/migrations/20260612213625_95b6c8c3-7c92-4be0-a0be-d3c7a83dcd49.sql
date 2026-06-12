ALTER TABLE public.building_units
  ADD COLUMN IF NOT EXISTS map_kind text CHECK (map_kind IN ('rect','polygon')),
  ADD COLUMN IF NOT EXISTS map_geometry jsonb,
  ADD COLUMN IF NOT EXISTS map_color text;