-- Promote existing chemical and SDS records into the current operational
-- workflow. Nothing is deleted and no file/history row is archived.

BEGIN;

-- Existing functions still use the old value internally in a few compatibility
-- paths. Normalize that value before the new check constraints are applied.
ALTER TABLE public.chemical_inventory_holdings
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_workflow_origin_check;

ALTER TABLE public.chemical_sds_versions
  DROP CONSTRAINT IF EXISTS chemical_sds_versions_workflow_origin_check,
  DROP CONSTRAINT IF EXISTS chemical_sds_versions_source_holding_check;

CREATE OR REPLACE FUNCTION public.normalize_chemical_holding_workflow_origin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.workflow_origin = 'legacy' THEN
    NEW.workflow_origin := 'current';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_holding_workflow_origin_guard
  ON public.chemical_inventory_holdings;
CREATE TRIGGER chemical_holding_workflow_origin_guard
  BEFORE INSERT OR UPDATE OF workflow_origin
  ON public.chemical_inventory_holdings
  FOR EACH ROW EXECUTE FUNCTION public.normalize_chemical_holding_workflow_origin();

REVOKE ALL ON FUNCTION public.normalize_chemical_holding_workflow_origin()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_chemical_holding_workflow_origin()
  TO service_role;

CREATE OR REPLACE FUNCTION public.normalize_chemical_sds_workflow_origin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.workflow_origin = 'legacy'
    OR (NEW.workflow_origin = 'registry_v2' AND NEW.source_holding_id IS NULL)
  THEN
    NEW.workflow_origin := 'current';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_sds_workflow_origin_guard
  ON public.chemical_sds_versions;
CREATE TRIGGER chemical_sds_workflow_origin_guard
  BEFORE INSERT OR UPDATE OF workflow_origin, source_holding_id
  ON public.chemical_sds_versions
  FOR EACH ROW EXECUTE FUNCTION public.normalize_chemical_sds_workflow_origin();

REVOKE ALL ON FUNCTION public.normalize_chemical_sds_workflow_origin()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_chemical_sds_workflow_origin()
  TO service_role;

UPDATE public.chemical_inventory_holdings
SET workflow_origin = 'current'
WHERE workflow_origin = 'legacy';

UPDATE public.chemical_sds_versions
SET workflow_origin = 'current'
WHERE workflow_origin = 'legacy';

-- A linked department file is already an operational SDS for that holding.
-- Backfill only an unambiguous source holding; four versions intentionally
-- remain link-scoped because one version is shared by more than one file.
WITH linked AS (
  SELECT
    sds_version_id,
    count(DISTINCT holding_id) AS holding_count,
    (array_agg(holding_id ORDER BY holding_id))[1] AS holding_id
  FROM public.chemical_department_chemical_links
  WHERE sds_version_id IS NOT NULL
    AND holding_id IS NOT NULL
  GROUP BY sds_version_id
)
UPDATE public.chemical_sds_versions AS version
SET source_holding_id = linked.holding_id,
    updated_at = now()
FROM linked
WHERE version.id = linked.sds_version_id
  AND linked.holding_count = 1
  AND version.source_holding_id IS NULL;

-- Promote only versions with exactly one room holding and no department
-- holding. Product-level fallback remains forbidden when the scope is unclear.
WITH candidates AS (
  SELECT
    version.id AS version_id,
    (array_agg(holding.id ORDER BY holding.id)
      FILTER (WHERE holding.storage_scope = 'room'))[1] AS holding_id
  FROM public.chemical_sds_versions AS version
  JOIN public.chemical_inventory_holdings AS holding
    ON holding.product_id = version.product_id
  WHERE version.source_holding_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_chemical_links AS department_link
      WHERE department_link.sds_version_id = version.id
    )
  GROUP BY version.id
  HAVING count(*) FILTER (WHERE holding.storage_scope = 'room') = 1
    AND count(*) FILTER (WHERE holding.storage_scope = 'department') = 0
)
UPDATE public.chemical_sds_versions AS version
SET source_holding_id = candidates.holding_id,
    updated_at = now()
FROM candidates
WHERE version.id = candidates.version_id
  AND version.source_holding_id IS NULL;

ALTER TABLE public.chemical_inventory_holdings
  ADD CONSTRAINT chemical_inventory_holdings_workflow_origin_check
  CHECK (workflow_origin IN ('current', 'registry_v2'));

ALTER TABLE public.chemical_sds_versions
  ADD CONSTRAINT chemical_sds_versions_workflow_origin_check
  CHECK (workflow_origin IN ('current', 'registry_v2')),
  ADD CONSTRAINT chemical_sds_versions_source_holding_check CHECK (
    workflow_origin = 'current' OR source_holding_id IS NOT NULL
  );

-- Department holdings must never become eligible for the room/public SDS
-- library. Keep eligibility for a product-unit only when a room holding exists.
UPDATE public.chemical_unit_products AS unit_product
SET public_eligible = false
WHERE unit_product.public_eligible = true
  AND EXISTS (
    SELECT 1
    FROM public.chemical_inventory_holdings AS department_holding
    WHERE department_holding.product_id = unit_product.product_id
      AND department_holding.unit_id = unit_product.unit_id
      AND department_holding.storage_scope = 'department'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.chemical_inventory_holdings AS room_holding
    WHERE room_holding.product_id = unit_product.product_id
      AND room_holding.unit_id = unit_product.unit_id
      AND room_holding.storage_scope = 'room'
  );

-- Keep the compatibility trigger name for already-deployed callers, but make
-- linked department SDS records current instead of assigning the old label.
CREATE OR REPLACE FUNCTION public.mark_linked_department_sds_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.sds_version_id IS NOT NULL THEN
    UPDATE public.chemical_sds_versions
    SET workflow_origin = 'current'
    WHERE id = NEW.sds_version_id
      AND source_holding_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Publishing one SDS must not retarget an active publication in another unit
-- or another storage scope when the same product is used in both places.
CREATE OR REPLACE FUNCTION public.publish_chemical_sds(
  p_version_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_sds_versions%rowtype;
  target_unit_id uuid;
  target_destination text;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-product:' || current_row.product_id::text, 0
  ));

  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF current_row.file_id IS NULL THEN RAISE EXCEPTION 'sds_file_required'; END IF;

  IF current_row.source_holding_id IS NOT NULL THEN
    SELECT holding.unit_id, holding.storage_scope::text
    INTO target_unit_id, target_destination
    FROM public.chemical_inventory_holdings AS holding
    WHERE holding.id = current_row.source_holding_id;
  END IF;

  IF current_row.status <> 'approved' THEN
    UPDATE public.chemical_sds_versions
    SET status = 'superseded', updated_at = now()
    WHERE product_id = current_row.product_id
      AND status = 'approved'
      AND id <> p_version_id;

    UPDATE public.chemical_sds_versions
    SET status = 'approved', updated_at = now()
    WHERE id = p_version_id;
  END IF;

  IF target_unit_id IS NOT NULL AND target_destination IS NOT NULL THEN
    UPDATE public.chemical_sds_publications
    SET sds_version_id = p_version_id
    WHERE product_id = current_row.product_id
      AND unit_id = target_unit_id
      AND destination = target_destination
      AND status = 'active'
      AND sds_version_id <> p_version_id;
  END IF;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.publish', p_actor_id, p_version_id::text,
    jsonb_build_object(
      'before', current_row.status, 'after', 'approved',
      'product_id', current_row.product_id,
      'unit_id', target_unit_id, 'destination', target_destination
    )::text
  );
  RETURN p_version_id;
END;
$$;

-- Only room SDS may enter the public room library. Department SDS stay in the
-- department publication channel even though they share the same unit-product.
CREATE OR REPLACE FUNCTION public.link_chemical_sds_publication(
  p_holding_id uuid, p_sds_version_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  holding_row record;
  version_row record;
  preliminary_product_id uuid;
  target_destination text;
  target_department_code text;
  publication_id uuid;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT holding.product_id INTO preliminary_product_id
  FROM public.chemical_inventory_holdings AS holding
  WHERE holding.id = p_holding_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-product:' || preliminary_product_id::text, 0
  ));

  SELECT holding.id, holding.product_id, holding.unit_id, holding.storage_scope,
    holding.workflow_origin, product.canonical_name, product.lifecycle_status,
    unit.name_th AS unit_name, unit.active AS unit_active,
    unit_product.active AS unit_product_active,
    COALESCE(unit_product.preferred_name, product.canonical_name) AS display_name
  INTO holding_row
  FROM public.chemical_inventory_holdings AS holding
  JOIN public.chemical_products AS product ON product.id = holding.product_id
  JOIN public.chemical_units AS unit ON unit.id = holding.unit_id
  JOIN public.chemical_unit_products AS unit_product
    ON unit_product.product_id = holding.product_id AND unit_product.unit_id = holding.unit_id
  WHERE holding.id = p_holding_id
  FOR UPDATE OF holding;

  IF NOT FOUND THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;
  IF holding_row.lifecycle_status <> 'active'
    OR holding_row.unit_active IS DISTINCT FROM true
    OR holding_row.unit_product_active IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'chemical_holding_inactive'; END IF;

  SELECT version.id, version.product_id, version.file_id, version.status
  INTO version_row
  FROM public.chemical_sds_versions AS version
  WHERE version.id = p_sds_version_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  IF version_row.product_id <> holding_row.product_id THEN RAISE EXCEPTION 'sds_product_mismatch'; END IF;
  IF version_row.status <> 'approved' OR version_row.file_id IS NULL THEN RAISE EXCEPTION 'approved_sds_pdf_required'; END IF;

  target_destination := holding_row.storage_scope;
  IF target_destination = 'department' THEN
    SELECT department.code INTO target_department_code
    FROM public.chemical_sds_departments AS department
    WHERE department.department = holding_row.unit_name
    FOR UPDATE;
    IF target_department_code IS NULL THEN RAISE EXCEPTION 'department_sds_unit_not_found'; END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    holding_row.product_id::text || ':' || holding_row.unit_id::text || ':' || target_destination, 0
  ));

  UPDATE public.chemical_sds_publications
  SET status = 'stale', stale_at = now()
  WHERE product_id = holding_row.product_id
    AND unit_id = holding_row.unit_id
    AND chemical_sds_publications.destination = target_destination
    AND status = 'active';

  INSERT INTO public.chemical_sds_publications(
    product_id, unit_id, source_holding_id, sds_version_id, destination,
    department_code, display_name, status, linked_by
  ) VALUES (
    holding_row.product_id, holding_row.unit_id, holding_row.id,
    p_sds_version_id, target_destination, target_department_code, holding_row.display_name,
    'active', p_actor_id
  ) RETURNING id INTO publication_id;

  IF target_destination = 'room' THEN
    UPDATE public.chemical_unit_products
    SET public_eligible = true
    WHERE product_id = holding_row.product_id AND unit_id = holding_row.unit_id;
  END IF;

  IF target_destination = 'department' THEN
    UPDATE public.chemical_sds_departments
    SET status = 'draft', published_by = NULL, published_at = NULL, updated_at = now()
    WHERE code = target_department_code;
  END IF;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES ('chemical_safety.sds.publish_link', p_actor_id, publication_id::text,
    jsonb_build_object('holding_id', p_holding_id, 'sds_version_id', p_sds_version_id,
      'destination', target_destination, 'department_code', target_department_code)::text);
  RETURN publication_id;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
