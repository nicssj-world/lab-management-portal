-- Keep the capture state truthful when a user later fills the quantity fields
-- on an SDS-only holding from the current registry workflow.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_chemical_inventory_capture_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.package_value IS NOT NULL
    AND NEW.package_unit IS NOT NULL
    AND NEW.current_container_count IS NOT NULL
    AND NEW.minimum_stock IS NOT NULL
  THEN
    NEW.inventory_capture_status := 'complete';
  ELSE
    NEW.inventory_capture_status := 'sds_only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_inventory_capture_status_guard
  ON public.chemical_inventory_holdings;
CREATE TRIGGER chemical_inventory_capture_status_guard
  BEFORE INSERT OR UPDATE OF package_value, package_unit,
    current_container_count, minimum_stock, inventory_capture_status
  ON public.chemical_inventory_holdings
  FOR EACH ROW EXECUTE FUNCTION public.normalize_chemical_inventory_capture_status();

REVOKE ALL ON FUNCTION public.normalize_chemical_inventory_capture_status()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_chemical_inventory_capture_status()
  TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
