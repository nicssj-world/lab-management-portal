-- Registry-first SDS workflow. Existing rows are deliberately classified as
-- legacy before defaults are changed, so this migration never changes their
-- public identifiers or their current workflow behaviour.
BEGIN;

CREATE TABLE IF NOT EXISTS public.chemical_registry_v2_migration_counts (
  holding_count bigint NOT NULL,
  version_count bigint NOT NULL,
  department_file_count bigint NOT NULL,
  product_count bigint NOT NULL,
  product_public_id_count bigint NOT NULL,
  department_public_id_count bigint NOT NULL
);
ALTER TABLE public.chemical_registry_v2_migration_counts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chemical_registry_v2_migration_counts
  FROM PUBLIC, anon, authenticated;
TRUNCATE public.chemical_registry_v2_migration_counts;
INSERT INTO public.chemical_registry_v2_migration_counts
SELECT
  (SELECT count(*) FROM public.chemical_inventory_holdings) AS holding_count,
  (SELECT count(*) FROM public.chemical_sds_versions) AS version_count,
  (SELECT count(*) FROM public.chemical_department_sds) AS department_file_count,
  (SELECT count(*) FROM public.chemical_products) AS product_count,
  (SELECT count(DISTINCT public_id) FROM public.chemical_products) AS product_public_id_count,
  (SELECT count(DISTINCT public_id) FROM public.chemical_department_sds) AS department_public_id_count;

ALTER TABLE public.chemical_inventory_holdings
  ADD COLUMN IF NOT EXISTS workflow_origin text;

UPDATE public.chemical_inventory_holdings
SET workflow_origin = 'legacy'
WHERE workflow_origin IS NULL;

ALTER TABLE public.chemical_inventory_holdings
  ALTER COLUMN workflow_origin SET DEFAULT 'registry_v2',
  ALTER COLUMN workflow_origin SET NOT NULL,
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_workflow_origin_check;
ALTER TABLE public.chemical_inventory_holdings
  ADD CONSTRAINT chemical_inventory_holdings_workflow_origin_check
    CHECK (workflow_origin IN ('legacy', 'registry_v2'));

ALTER TABLE public.chemical_sds_versions
  ADD COLUMN IF NOT EXISTS workflow_origin text,
  ADD COLUMN IF NOT EXISTS source_holding_id uuid
    REFERENCES public.chemical_inventory_holdings(id) ON DELETE RESTRICT;

UPDATE public.chemical_sds_versions
SET workflow_origin = 'legacy'
WHERE workflow_origin IS NULL;

ALTER TABLE public.chemical_sds_versions
  ALTER COLUMN workflow_origin SET DEFAULT 'registry_v2',
  ALTER COLUMN workflow_origin SET NOT NULL,
  DROP CONSTRAINT IF EXISTS chemical_sds_versions_workflow_origin_check,
  DROP CONSTRAINT IF EXISTS chemical_sds_versions_source_holding_check;
ALTER TABLE public.chemical_sds_versions
  ADD CONSTRAINT chemical_sds_versions_workflow_origin_check
    CHECK (workflow_origin IN ('legacy', 'registry_v2')),
  ADD CONSTRAINT chemical_sds_versions_source_holding_check CHECK (
    workflow_origin = 'legacy' OR source_holding_id IS NOT NULL
  );

-- Compatibility SQL creates legacy versions without source_holding_id. Keep
-- those inserts valid while making a NULL source impossible for registry_v2.
CREATE OR REPLACE FUNCTION public.normalize_chemical_sds_workflow_origin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.source_holding_id IS NULL THEN
    NEW.workflow_origin := 'legacy';
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

CREATE INDEX IF NOT EXISTS idx_chemical_sds_versions_source_holding
  ON public.chemical_sds_versions(source_holding_id)
  WHERE source_holding_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chemical_sds_versions_open_per_holding
  ON public.chemical_sds_versions(source_holding_id)
  WHERE source_holding_id IS NOT NULL AND status IN ('draft', 'in_review');

-- Keep versions created by the old "import department SDS" action in the
-- compatibility workflow even though the table default is registry_v2.
CREATE OR REPLACE FUNCTION public.mark_linked_department_sds_legacy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.sds_version_id IS NOT NULL THEN
    UPDATE public.chemical_sds_versions
    SET workflow_origin = 'legacy'
    WHERE id = NEW.sds_version_id
      AND source_holding_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_department_link_marks_legacy
  ON public.chemical_department_chemical_links;
CREATE TRIGGER chemical_department_link_marks_legacy
  AFTER INSERT OR UPDATE OF sds_version_id
  ON public.chemical_department_chemical_links
  FOR EACH ROW EXECUTE FUNCTION public.mark_linked_department_sds_legacy();

REVOKE ALL ON FUNCTION public.mark_linked_department_sds_legacy()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_linked_department_sds_legacy()
  TO service_role;

CREATE TABLE IF NOT EXISTS public.chemical_sds_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.chemical_products(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.chemical_units(id) ON DELETE RESTRICT,
  source_holding_id uuid NOT NULL REFERENCES public.chemical_inventory_holdings(id) ON DELETE RESTRICT,
  sds_version_id uuid NOT NULL REFERENCES public.chemical_sds_versions(id) ON DELETE RESTRICT,
  destination text NOT NULL CHECK (destination IN ('room', 'department')),
  department_code text REFERENCES public.chemical_sds_departments(code)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (nullif(btrim(display_name), '') IS NOT NULL),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'stale')),
  linked_by uuid REFERENCES public.profiles(id),
  linked_at timestamptz NOT NULL DEFAULT now(),
  stale_at timestamptz,
  CONSTRAINT chemical_sds_publications_destination_department_check CHECK (
    (destination = 'room' AND department_code IS NULL)
    OR (destination = 'department' AND department_code IS NOT NULL)
  ),
  CONSTRAINT chemical_sds_publications_status_time_check CHECK (
    (status = 'active' AND stale_at IS NULL)
    OR (status = 'stale' AND stale_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chemical_sds_publications_active_destination
  ON public.chemical_sds_publications(product_id, unit_id, destination)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_chemical_sds_publications_public_lookup
  ON public.chemical_sds_publications(public_id, status);
CREATE INDEX IF NOT EXISTS idx_chemical_sds_publications_version
  ON public.chemical_sds_publications(sds_version_id);

ALTER TABLE public.chemical_sds_publications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.chemical_sds_publications
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemical_sds_publications
  TO service_role;

ALTER TABLE public.chemical_change_requests
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_type_check,
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_id_required;
ALTER TABLE public.chemical_change_requests
  ADD CONSTRAINT chemical_change_requests_entity_type_check
    CHECK (entity_type IN ('product', 'holding', 'new_chemical', 'department_chemical', 'registry_entry')),
  ADD CONSTRAINT chemical_change_requests_entity_id_required CHECK (
    (entity_type IN ('new_chemical', 'department_chemical') AND entity_id IS NULL)
    OR (
      entity_type = 'registry_entry'
      AND (
        (status IN ('draft', 'in_review', 'rejected') AND entity_id IS NULL)
        OR (status = 'approved' AND entity_id IS NOT NULL)
      )
    )
    OR (entity_type IN ('product', 'holding') AND entity_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.review_chemical_registry_entry_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_product_id uuid;
  target_holding_id uuid;
  product_mode text;
  target_storage_scope text;
  target_location_id uuid;
  target_canonical_name text;
  request_after jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'registry_entry' THEN RAISE EXCEPTION 'invalid_registry_entry_request'; END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' THEN
    product_mode := current_row.proposed_data->>'product_mode';
    target_storage_scope := current_row.proposed_data->>'storage_scope';

    IF product_mode NOT IN ('new', 'existing')
      OR target_storage_scope NOT IN ('room', 'department')
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR current_row.proposed_data->>'package_unit' NOT IN ('mL', 'L', 'g', 'kg')
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
    THEN RAISE EXCEPTION 'invalid_registry_entry_snapshot'; END IF;

    IF target_storage_scope = 'room' THEN
      IF jsonb_typeof(current_row.proposed_data->'location_id') <> 'string' THEN
        RAISE EXCEPTION 'registry_room_location_required';
      END IF;
      target_location_id := (current_row.proposed_data->>'location_id')::uuid;
      IF NOT EXISTS (
        SELECT 1 FROM public.chemical_storage_locations
        WHERE id = target_location_id AND active = true
      ) THEN RAISE EXCEPTION 'chemical_location_not_found'; END IF;
    ELSIF current_row.proposed_data ? 'location_id'
      AND jsonb_typeof(current_row.proposed_data->'location_id') <> 'null'
    THEN
      RAISE EXCEPTION 'registry_department_location_forbidden';
    END IF;

    IF target_storage_scope = 'department' AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_units AS unit
      JOIN public.chemical_sds_departments AS department
        ON department.department = unit.name_th
      WHERE unit.id = current_row.unit_id AND unit.active = true
    ) THEN
      RAISE EXCEPTION 'department_sds_unit_not_found';
    END IF;

    IF product_mode = 'existing' THEN
      IF jsonb_typeof(current_row.proposed_data->'product_id') <> 'string' THEN
        RAISE EXCEPTION 'registry_product_required';
      END IF;
      SELECT product.id, product.canonical_name
      INTO target_product_id, target_canonical_name
      FROM public.chemical_products AS product
      WHERE product.id = (current_row.proposed_data->>'product_id')::uuid
        AND product.lifecycle_status = 'active'
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'chemical_product_not_found'; END IF;
    ELSE
      target_canonical_name := nullif(btrim(current_row.proposed_data->>'canonical_name'), '');
      IF target_canonical_name IS NULL THEN RAISE EXCEPTION 'registry_product_name_required'; END IF;

      INSERT INTO public.chemical_products (
        canonical_name, cas_number, manufacturer, supplier, product_code,
        concentration, physical_state, lifecycle_status, ghs_source_text,
        ghs_pictogram_codes, ghs_hazard_classes, created_by
      ) VALUES (
        target_canonical_name,
        current_row.proposed_data->>'cas_number',
        current_row.proposed_data->>'manufacturer',
        current_row.proposed_data->>'supplier',
        current_row.proposed_data->>'product_code',
        current_row.proposed_data->>'concentration',
        current_row.proposed_data->>'physical_state',
        'active',
        current_row.proposed_data->>'ghs_source_text',
        COALESCE((
          SELECT array_agg(value)
          FROM jsonb_array_elements_text(
            COALESCE(current_row.proposed_data->'ghs_pictogram_codes', '[]'::jsonb)
          ) AS value
        ), ARRAY[]::text[]),
        COALESCE(current_row.proposed_data->'ghs_hazard_classes', '[]'::jsonb),
        current_row.created_by
      ) RETURNING id INTO target_product_id;

      INSERT INTO public.chemical_product_aliases(product_id, alias, normalized_alias)
      SELECT target_product_id, alias.value, lower(btrim(alias.value))
      FROM jsonb_array_elements_text(
        COALESCE(current_row.proposed_data->'aliases', '[]'::jsonb)
      ) AS alias(value)
      WHERE nullif(btrim(alias.value), '') IS NOT NULL
      ON CONFLICT (product_id, normalized_alias) DO NOTHING;
    END IF;

    INSERT INTO public.chemical_unit_products(
      product_id, unit_id, preferred_name, active, public_eligible
    ) VALUES (target_product_id, current_row.unit_id, target_canonical_name, true, false)
    ON CONFLICT (product_id, unit_id) DO UPDATE
      SET preferred_name = COALESCE(public.chemical_unit_products.preferred_name, EXCLUDED.preferred_name),
        active = true;

    INSERT INTO public.chemical_inventory_holdings (
      product_id, unit_id, storage_scope, location_id, lot_number,
      package_value, package_unit, current_container_count, minimum_stock,
      reported_total_raw, calculated_total_value, calculated_total_unit,
      received_on, opened_on, expires_on, effective_on,
      workflow_origin, approved_by, approved_at
    ) VALUES (
      target_product_id, current_row.unit_id, target_storage_scope, target_location_id,
      current_row.proposed_data->>'lot_number',
      (current_row.proposed_data->>'package_value')::numeric,
      current_row.proposed_data->>'package_unit',
      (current_row.proposed_data->>'current_container_count')::integer,
      (current_row.proposed_data->>'minimum_stock')::numeric,
      current_row.proposed_data->>'reported_total_raw',
      (current_row.proposed_data->>'calculated_total_value')::numeric,
      current_row.proposed_data->>'calculated_total_unit',
      (current_row.proposed_data->>'received_on')::date,
      (current_row.proposed_data->>'opened_on')::date,
      (current_row.proposed_data->>'expires_on')::date,
      (current_row.proposed_data->>'effective_on')::date,
      'registry_v2', p_actor_id, now()
    ) RETURNING id INTO target_holding_id;
  END IF;

  UPDATE public.chemical_change_requests AS request
  SET entity_id = CASE WHEN p_decision = 'approved' THEN target_holding_id ELSE entity_id END,
    status = p_decision,
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''),
    updated_at = now()
  WHERE request.id = p_request_id
  RETURNING to_jsonb(request) INTO request_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.registry_entry.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', to_jsonb(current_row), 'after', request_after,
      'product_id', target_product_id, 'holding_id', target_holding_id, 'reason', p_reason
    )::text
  );
  RETURN p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_chemical_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE entity_type text;
  holding_scope text;
  reviewed_request_id uuid;
BEGIN
  SELECT request.entity_type INTO entity_type
  FROM public.chemical_change_requests AS request
  WHERE request.id = p_request_id;

  IF entity_type = 'registry_entry' THEN
    RETURN public.review_chemical_registry_entry_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
  END IF;
  IF entity_type = 'new_chemical' THEN
    UPDATE public.chemical_change_requests
    SET entity_type = 'registry_entry',
      proposed_data = proposed_data || jsonb_build_object(
        'product_mode', 'new', 'storage_scope', 'room'
      ),
      updated_at = now()
    WHERE id = p_request_id;
    RETURN public.review_chemical_registry_entry_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
  END IF;
  IF entity_type = 'product' THEN
    RETURN public.review_chemical_product_change_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
  END IF;
  IF entity_type = 'department_chemical' THEN
    reviewed_request_id := public.review_chemical_department_change_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
    IF p_decision = 'approved' THEN
      UPDATE public.chemical_inventory_holdings AS holding
      SET workflow_origin = 'legacy'
      FROM public.chemical_department_chemical_links AS department_link,
        public.chemical_change_requests AS request
      WHERE request.id = p_request_id
        AND department_link.department_sds_id = (request.proposed_data->>'source_department_sds_id')::uuid
        AND holding.id = department_link.holding_id;
    END IF;
    RETURN reviewed_request_id;
  END IF;
  IF entity_type = 'holding' THEN
    SELECT holding.storage_scope INTO holding_scope
    FROM public.chemical_inventory_holdings AS holding
    JOIN public.chemical_change_requests AS request ON request.entity_id = holding.id
    WHERE request.id = p_request_id;
    IF holding_scope = 'department' THEN
      RETURN public.review_chemical_department_holding_change_request(
        p_request_id, p_actor_id, p_decision, p_reason
      );
    END IF;
  END IF;
  RETURN public.review_chemical_change_request_legacy(
    p_request_id, p_actor_id, p_decision, p_reason
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_chemical_sds_version(
  p_version_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_sds_versions%rowtype;
  superseded_row public.chemical_sds_versions%rowtype;
  superseded_before jsonb;
  reviewed_after jsonb;
  affected_departments text[];
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  SELECT * INTO current_row FROM public.chemical_sds_versions
    WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-product:' || current_row.product_id::text, 0
  ));
  SELECT * INTO current_row FROM public.chemical_sds_versions
    WHERE id = p_version_id FOR UPDATE;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'sds_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN RAISE EXCEPTION 'rejection_reason_required'; END IF;

  IF p_decision = 'approved' THEN
    PERFORM 1 FROM public.chemical_products WHERE id = current_row.product_id FOR UPDATE;
    SELECT array_agg(DISTINCT publication.department_code)
    INTO affected_departments
    FROM public.chemical_sds_publications AS publication
    JOIN public.chemical_sds_versions AS version ON version.id = publication.sds_version_id
    WHERE version.product_id = current_row.product_id
      AND publication.status = 'active'
      AND publication.department_code IS NOT NULL;

    IF affected_departments IS NOT NULL THEN
      PERFORM 1
      FROM public.chemical_sds_departments AS department
      WHERE department.code = ANY(affected_departments)
      ORDER BY department.code
      FOR UPDATE;
    END IF;

    UPDATE public.chemical_sds_publications AS publication
    SET status = 'stale', stale_at = now()
    FROM public.chemical_sds_versions AS version
    WHERE publication.sds_version_id = version.id
      AND version.product_id = current_row.product_id
      AND publication.status = 'active';

    UPDATE public.chemical_unit_products AS unit_product
    SET public_eligible = false
    WHERE unit_product.product_id = current_row.product_id
      AND EXISTS (
        SELECT 1 FROM public.chemical_sds_publications AS stale_publication
        WHERE stale_publication.product_id = unit_product.product_id
          AND stale_publication.unit_id = unit_product.unit_id
          AND stale_publication.status = 'stale'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.chemical_sds_publications AS active_publication
        WHERE active_publication.product_id = unit_product.product_id
          AND active_publication.unit_id = unit_product.unit_id
          AND active_publication.status = 'active'
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.chemical_inventory_holdings AS legacy_holding
        WHERE legacy_holding.product_id = unit_product.product_id
          AND legacy_holding.unit_id = unit_product.unit_id
          AND legacy_holding.workflow_origin = 'legacy'
      );

    IF affected_departments IS NOT NULL THEN
      UPDATE public.chemical_sds_departments
      SET status = 'draft', published_by = NULL, published_at = NULL, updated_at = now()
      WHERE code = ANY(affected_departments);
    END IF;

    FOR superseded_row IN
      SELECT * FROM public.chemical_sds_versions
      WHERE product_id = current_row.product_id AND status = 'approved' AND id <> p_version_id
      FOR UPDATE
    LOOP
      superseded_before := to_jsonb(superseded_row);
      UPDATE public.chemical_sds_versions
      SET status = 'superseded', updated_at = now()
      WHERE id = superseded_row.id
      RETURNING * INTO superseded_row;
      INSERT INTO public.audit_log(action, user_id, target, detail)
      VALUES ('chemical_safety.sds.supersede', p_actor_id, superseded_row.id::text,
        jsonb_build_object('before', superseded_before, 'after', to_jsonb(superseded_row),
          'replacement_version_id', p_version_id)::text);
    END LOOP;
  END IF;

  UPDATE public.chemical_sds_versions AS reviewed_version
  SET status = p_decision, reviewed_by = p_actor_id, reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''), updated_at = now()
  WHERE reviewed_version.id = p_version_id
  RETURNING to_jsonb(reviewed_version) INTO reviewed_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES ('chemical_safety.sds.review', p_actor_id, p_version_id::text,
    jsonb_build_object('before', to_jsonb(current_row), 'after', reviewed_after, 'reason', p_reason)::text);
  RETURN p_version_id;
END;
$$;

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

  UPDATE public.chemical_unit_products
  SET public_eligible = true
  WHERE product_id = holding_row.product_id AND unit_id = holding_row.unit_id;

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

CREATE OR REPLACE FUNCTION public.set_chemical_sds_department_publication_status(
  p_department_code text, p_status text, p_actor_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  department_row public.chemical_sds_departments%rowtype;
  legacy_count bigint;
  registry_count bigint;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  IF p_status NOT IN ('draft', 'published') THEN RAISE EXCEPTION 'invalid_department_sds_status'; END IF;

  SELECT * INTO department_row
  FROM public.chemical_sds_departments AS department
  WHERE department.code = p_department_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'department_sds_not_found'; END IF;

  IF p_status = 'published' THEN
    SELECT count(*) INTO legacy_count
    FROM public.chemical_department_sds AS entry
    WHERE entry.department_code = p_department_code;

    SELECT count(*) INTO registry_count
    FROM public.chemical_sds_publications AS publication
    WHERE publication.department_code = p_department_code
      AND publication.destination = 'department'
      AND publication.status = 'active';

    IF legacy_count + registry_count = 0 THEN
      RAISE EXCEPTION 'department_sds_empty';
    END IF;
  END IF;

  UPDATE public.chemical_sds_departments
  SET status = p_status,
    published_by = CASE WHEN p_status = 'published' THEN p_actor_id ELSE NULL END,
    published_at = CASE WHEN p_status = 'published' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE code = p_department_code;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES ('chemical_safety.department_sds.publish', p_actor_id, p_department_code,
    jsonb_build_object('department', department_row.department, 'status', p_status)::text);
  RETURN p_status;
END;
$$;

REVOKE ALL ON FUNCTION public.review_chemical_registry_entry_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_registry_entry_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_sds_version(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_sds_version(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.link_chemical_sds_publication(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_chemical_sds_publication(uuid,uuid,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.set_chemical_sds_department_publication_status(text,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_chemical_sds_department_publication_status(text,text,uuid)
  TO service_role;

DO $$
DECLARE before_counts record;
BEGIN
  SELECT * INTO before_counts FROM public.chemical_registry_v2_migration_counts;
  IF before_counts.holding_count <> (SELECT count(*) FROM public.chemical_inventory_holdings)
    OR before_counts.version_count <> (SELECT count(*) FROM public.chemical_sds_versions)
    OR before_counts.department_file_count <> (SELECT count(*) FROM public.chemical_department_sds)
    OR before_counts.product_count <> (SELECT count(*) FROM public.chemical_products)
    OR before_counts.product_public_id_count <> (SELECT count(DISTINCT public_id) FROM public.chemical_products)
    OR before_counts.department_public_id_count <> (SELECT count(DISTINCT public_id) FROM public.chemical_department_sds)
  THEN
    RAISE EXCEPTION 'registry_v2_backfill_count_mismatch';
  END IF;
END;
$$;

DROP TABLE IF EXISTS public.chemical_registry_v2_migration_counts;

NOTIFY pgrst, 'reload schema';
COMMIT;

