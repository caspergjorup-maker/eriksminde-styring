ALTER TABLE public.buildings
  ADD COLUMN IF NOT EXISTS building_nr text,
  ADD COLUMN IF NOT EXISTS map_color text,
  ADD COLUMN IF NOT EXISTS map_section text,
  ADD COLUMN IF NOT EXISTS map_x integer,
  ADD COLUMN IF NOT EXISTS map_y integer,
  ADD COLUMN IF NOT EXISTS map_w integer,
  ADD COLUMN IF NOT EXISTS map_h integer,
  ADD COLUMN IF NOT EXISTS map_shape text DEFAULT 'rect';