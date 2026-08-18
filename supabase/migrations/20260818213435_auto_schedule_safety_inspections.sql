BEGIN;

-- The next inspection is a system-owned date: thirty calendar days after the
-- inspection date. Keep the RPC argument for compatibility, but never trust
-- a client-provided value when a row is inserted.
UPDATE public.lab_map_safety_inspections
SET next_inspection_date = inspected_on + 30
WHERE next_inspection_date IS DISTINCT FROM inspected_on + 30;

CREATE OR REPLACE FUNCTION public.set_lab_map_safety_inspection_schedule()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.next_inspection_date := NEW.inspected_on + 30;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lab_map_safety_inspections_auto_schedule
  ON public.lab_map_safety_inspections;

CREATE TRIGGER lab_map_safety_inspections_auto_schedule
  BEFORE INSERT ON public.lab_map_safety_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_lab_map_safety_inspection_schedule();

REVOKE ALL ON FUNCTION public.set_lab_map_safety_inspection_schedule()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_lab_map_safety_inspection_schedule()
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
