DELETE FROM public.budget_scenarios s
WHERE NOT EXISTS (SELECT 1 FROM public.budget_lines l WHERE l.scenario_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.budget_loans lo WHERE lo.scenario_id = s.id)
  AND EXISTS (
    SELECT 1 FROM public.budget_scenarios s2
    WHERE s2.year = s.year AND s2.id <> s.id
  );

UPDATE public.budget_scenarios SET name = 'Budget ' || year::text, is_primary = true;

ALTER TABLE public.budget_scenarios ADD CONSTRAINT budget_scenarios_year_unique UNIQUE (year);