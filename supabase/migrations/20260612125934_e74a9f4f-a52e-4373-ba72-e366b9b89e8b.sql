ALTER TABLE public.buildings
  ADD COLUMN build_year integer,
  ADD COLUMN area_m2_gross numeric,
  ADD COLUMN area_m2_net numeric,
  ADD COLUMN floors integer DEFAULT 1,
  ADD COLUMN condition text CHECK (condition IN ('god', 'vedligeholdelse_nødvendig', 'renovering_nødvendig')),
  ADD COLUMN last_inspection date,
  ADD COLUMN lease_status text DEFAULT 'ledig' CHECK (lease_status IN ('udlejet', 'ledig', 'ikke_klar', 'intern_brug', 'udlejes_ikke')),
  ADD COLUMN lease_status_note text,
  ADD COLUMN estimated_monthly_rent numeric,
  ADD COLUMN has_electricity boolean DEFAULT false,
  ADD COLUMN has_water boolean DEFAULT false,
  ADD COLUMN has_heating boolean DEFAULT false,
  ADD COLUMN heating_type text CHECK (heating_type IN ('fjernvarme', 'olie', 'varmepumpe', 'elvarme', 'ingen')),
  ADD COLUMN has_sewage boolean DEFAULT false,
  ADD COLUMN has_internet boolean DEFAULT false,
  ADD COLUMN parcel_id uuid,
  ADD COLUMN internal_notes text;

UPDATE public.buildings SET
  lease_status = 'udlejet',
  has_electricity = true, has_water = true, has_heating = true,
  heating_type = 'fjernvarme'
WHERE name = 'Stuehus';

UPDATE public.buildings SET lease_status = 'udlejet'
WHERE name IN ('Lade', 'Vestlænge', 'Stald 1', 'Stald 2', 'Stald 3');

UPDATE public.buildings SET
  lease_status = 'intern_brug',
  lease_status_note = 'Bruges til halmopbevaring'
WHERE name = 'Maskinhus';

UPDATE public.buildings SET
  lease_status = 'intern_brug',
  lease_status_note = 'Intern tværbygning'
WHERE name = 'Foderrum';

UPDATE public.buildings SET
  lease_status = 'intern_brug',
  lease_status_note = 'Gylletank — ikke relevant for udlejning'
WHERE name = 'Gylletank';