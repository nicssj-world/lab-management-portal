-- นำสารจากคลัง SDS แยกตามงานเข้าสู่ทะเบียนสารเคมี
-- รันหลัง scripts/chemical-safety-module.sql,
-- scripts/chemical-safety-ghs-and-departments.sql และ
-- scripts/chemical-safety-registry-crud.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. แยกขอบเขตการจัดเก็บของ holding ออกจากตำแหน่งในห้องสารเคมี
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chemical_inventory_holdings
  ADD COLUMN IF NOT EXISTS storage_scope text NOT NULL DEFAULT 'room';

ALTER TABLE public.chemical_inventory_holdings
  ALTER COLUMN location_id DROP NOT NULL;

ALTER TABLE public.chemical_inventory_holdings
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_storage_scope_check,
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_location_scope_check;

ALTER TABLE public.chemical_inventory_holdings
  ADD CONSTRAINT chemical_inventory_holdings_storage_scope_check
    CHECK (storage_scope IN ('room', 'department')),
  ADD CONSTRAINT chemical_inventory_holdings_location_scope_check
    CHECK (
      (storage_scope = 'room' AND location_id IS NOT NULL)
      OR (storage_scope = 'department' AND location_id IS NULL)
    );

CREATE INDEX IF NOT EXISTS idx_chemical_holdings_scope_unit
  ON public.chemical_inventory_holdings(storage_scope, unit_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Link SDS งานกับรายการทะเบียนที่อนุมัติแล้ว
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chemical_department_chemical_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_sds_id uuid NOT NULL UNIQUE
    REFERENCES public.chemical_department_sds(id) ON DELETE RESTRICT,
  product_id uuid NOT NULL
    REFERENCES public.chemical_products(id) ON DELETE RESTRICT,
  holding_id uuid NOT NULL UNIQUE
    REFERENCES public.chemical_inventory_holdings(id) ON DELETE RESTRICT,
  sds_version_id uuid REFERENCES public.chemical_sds_versions(id) ON DELETE SET NULL,
  linked_by uuid REFERENCES public.profiles(id),
  linked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chemical_department_links_product
  ON public.chemical_department_chemical_links(product_id);

ALTER TABLE public.chemical_department_chemical_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chemical_department_chemical_links
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.chemical_department_chemical_links
  TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_linked_department_sds_file_change()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.file_id IS DISTINCT FROM OLD.file_id
    AND EXISTS (
      SELECT 1
      FROM public.chemical_department_chemical_links AS link
      WHERE link.department_sds_id = OLD.id
    )
  THEN
    RAISE EXCEPTION 'department_sds_already_linked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_department_sds_file_change_guard
  ON public.chemical_department_sds;
CREATE TRIGGER chemical_department_sds_file_change_guard
  BEFORE UPDATE OF file_id ON public.chemical_department_sds
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_linked_department_sds_file_change();

REVOKE ALL ON FUNCTION public.prevent_linked_department_sds_file_change()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_linked_department_sds_file_change()
  TO service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ให้ change request รองรับรายการที่ยังไม่มี entity/holding ก่อนอนุมัติ
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chemical_change_requests
  ALTER COLUMN entity_id DROP NOT NULL;

ALTER TABLE public.chemical_change_requests
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_type_check,
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_id_required;

ALTER TABLE public.chemical_change_requests
  ADD CONSTRAINT chemical_change_requests_entity_type_check
    CHECK (entity_type IN ('product', 'holding', 'new_chemical', 'department_chemical')),
  ADD CONSTRAINT chemical_change_requests_entity_id_required CHECK (
    (entity_type IN ('new_chemical', 'department_chemical') AND entity_id IS NULL)
    OR (entity_type IN ('product', 'holding') AND entity_id IS NOT NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. อนุมัติคำขอจาก SDS งานใน transaction เดียว
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_chemical_department_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  source_row record;
  target_after jsonb;
  request_after jsonb;
  product_row public.chemical_products%rowtype;
  product_id uuid;
  holding_id uuid;
  sds_version_id uuid;
  canonical_name text;
  cas_number text;
  source_department_sds_id uuid;
  source_file_id uuid;
  source_unit_id uuid;
  product_keys constant text[] := ARRAY[
    'product_id', 'source_department_sds_id', 'canonical_name', 'aliases',
    'cas_number', 'manufacturer', 'supplier', 'product_code', 'concentration',
    'physical_state', 'storage_scope', 'location_id', 'lot_number',
    'package_value', 'package_unit', 'current_container_count', 'minimum_stock',
    'reported_total_raw', 'calculated_total_value', 'calculated_total_unit',
    'received_on', 'opened_on', 'expires_on', 'effective_on', 'ghs_source_text',
    'ghs_pictogram_codes', 'ghs_hazard_classes'
  ];
  required_keys constant text[] := ARRAY[
    'source_department_sds_id', 'canonical_name', 'storage_scope',
    'package_value', 'package_unit', 'current_container_count', 'minimum_stock'
  ];
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'department_chemical' THEN
    RAISE EXCEPTION 'invalid_department_change_request';
  END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' THEN
    IF NOT current_row.proposed_data ?& required_keys
      OR EXISTS (
        SELECT 1
        FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(product_keys))
      )
      OR jsonb_typeof(current_row.proposed_data->'source_department_sds_id') <> 'string'
      OR nullif(btrim(current_row.proposed_data->>'canonical_name'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'canonical_name') <> 'string'
      OR current_row.proposed_data->>'storage_scope' <> 'department'
      OR (
        current_row.proposed_data ? 'location_id'
        AND jsonb_typeof(current_row.proposed_data->'location_id') <> 'null'
      )
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR jsonb_typeof(current_row.proposed_data->'package_unit') <> 'string'
      OR current_row.proposed_data->>'package_unit' NOT IN ('mL', 'L', 'g', 'kg')
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR floor((current_row.proposed_data->>'current_container_count')::numeric)
        <> (current_row.proposed_data->>'current_container_count')::numeric
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR floor((current_row.proposed_data->>'minimum_stock')::numeric)
        <> (current_row.proposed_data->>'minimum_stock')::numeric
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
      OR (
        current_row.proposed_data ? 'product_id'
        AND jsonb_typeof(current_row.proposed_data->'product_id') NOT IN ('string', 'null')
      )
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'cas_number', 'manufacturer', 'supplier', 'product_code', 'concentration',
          'physical_state', 'lot_number', 'reported_total_raw', 'calculated_total_unit',
          'received_on', 'opened_on', 'expires_on', 'effective_on', 'ghs_source_text'
        ])
        AND jsonb_typeof(value) NOT IN ('string', 'null')
      )
      OR (
        current_row.proposed_data ? 'calculated_total_value'
        AND jsonb_typeof(current_row.proposed_data->'calculated_total_value') NOT IN ('number', 'null')
      )
      OR (
        current_row.proposed_data ? 'physical_state'
        AND current_row.proposed_data->>'physical_state' IS NOT NULL
        AND current_row.proposed_data->>'physical_state' NOT IN ('solid', 'liquid', 'gas', 'mixture', 'unknown')
      )
      OR (
        current_row.proposed_data ? 'aliases'
        AND (
          jsonb_typeof(current_row.proposed_data->'aliases') <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(current_row.proposed_data->'aliases') AS alias
            WHERE jsonb_typeof(alias) <> 'string' OR nullif(btrim(alias #>> '{}'), '') IS NULL
          )
        )
      )
      OR (
        current_row.proposed_data ? 'ghs_pictogram_codes'
        AND (
          jsonb_typeof(current_row.proposed_data->'ghs_pictogram_codes') <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS code
            WHERE code NOT IN ('GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09')
          )
        )
      )
      OR (
        current_row.proposed_data ? 'ghs_hazard_classes'
        AND NOT public.chemical_ghs_hazard_classes_valid(current_row.proposed_data->'ghs_hazard_classes')
      )
    THEN RAISE EXCEPTION 'invalid_department_chemical_snapshot'; END IF;

    source_department_sds_id := (current_row.proposed_data->>'source_department_sds_id')::uuid;
    SELECT entry.id, entry.file_id, entry.department_code, unit.id AS unit_id
    INTO source_row
    FROM public.chemical_department_sds AS entry
    JOIN public.chemical_sds_departments AS department
      ON department.code = entry.department_code
    LEFT JOIN public.chemical_units AS unit
      ON unit.name_th = department.department AND unit.active = true
    WHERE entry.id = source_department_sds_id
    FOR UPDATE OF entry;
    IF NOT FOUND OR source_row.unit_id IS NULL THEN
      RAISE EXCEPTION 'department_sds_unit_not_found';
    END IF;
    source_file_id := source_row.file_id;
    source_unit_id := source_row.unit_id;
    IF source_file_id IS NULL THEN
      RAISE EXCEPTION 'department_sds_file_not_found';
    END IF;
    IF source_unit_id <> current_row.unit_id THEN
      RAISE EXCEPTION 'department_sds_wrong_unit';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.chemical_department_chemical_links
      WHERE department_sds_id = source_department_sds_id
    ) THEN
      RAISE EXCEPTION 'department_sds_already_linked';
    END IF;

    canonical_name := current_row.proposed_data->>'canonical_name';
    cas_number := nullif(btrim(current_row.proposed_data->>'cas_number'), '');
    IF nullif(btrim(current_row.proposed_data->>'product_id'), '') IS NOT NULL THEN
      SELECT * INTO product_row
      FROM public.chemical_products
      WHERE id = (current_row.proposed_data->>'product_id')::uuid
      FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'chemical_product_not_found'; END IF;
      IF product_row.lifecycle_status <> 'active' THEN RAISE EXCEPTION 'chemical_product_inactive'; END IF;
      product_id := product_row.id;
    ELSE
      IF EXISTS (
        SELECT 1
        FROM public.chemical_products AS product
        WHERE lower(btrim(product.canonical_name)) = lower(btrim(canonical_name))
          OR (cas_number IS NOT NULL AND product.cas_number = cas_number)
      ) THEN
        RAISE EXCEPTION 'department_product_duplicate';
      END IF;

      INSERT INTO public.chemical_products (
        canonical_name, cas_number, manufacturer, supplier, product_code, concentration,
        physical_state, lifecycle_status, ghs_source_text, ghs_pictogram_codes,
        ghs_hazard_classes, created_by
      ) VALUES (
        canonical_name,
        cas_number,
        current_row.proposed_data->>'manufacturer',
        current_row.proposed_data->>'supplier',
        current_row.proposed_data->>'product_code',
        current_row.proposed_data->>'concentration',
        current_row.proposed_data->>'physical_state',
        'active',
        current_row.proposed_data->>'ghs_source_text',
        COALESCE(
          (SELECT array_agg(value) FROM jsonb_array_elements_text(
            COALESCE(current_row.proposed_data->'ghs_pictogram_codes', '[]'::jsonb)
          ) AS value),
          ARRAY[]::text[]
        ),
        COALESCE(current_row.proposed_data->'ghs_hazard_classes', '[]'::jsonb),
        current_row.created_by
      )
      RETURNING id INTO product_id;

      INSERT INTO public.chemical_product_aliases (product_id, alias, normalized_alias)
      SELECT product_id, alias.value, lower(btrim(alias.value))
      FROM jsonb_array_elements_text(COALESCE(current_row.proposed_data->'aliases', '[]'::jsonb)) AS alias(value)
      WHERE nullif(btrim(alias.value), '') IS NOT NULL
      ON CONFLICT (product_id, normalized_alias) DO NOTHING;
    END IF;

    INSERT INTO public.chemical_unit_products (product_id, unit_id, preferred_name, active, public_eligible)
    VALUES (product_id, current_row.unit_id, canonical_name, true, false)
    ON CONFLICT (product_id, unit_id) DO UPDATE SET
      active = true,
      preferred_name = COALESCE(public.chemical_unit_products.preferred_name, EXCLUDED.preferred_name);

    INSERT INTO public.chemical_inventory_holdings (
      product_id, unit_id, storage_scope, location_id, lot_number, package_value, package_unit,
      current_container_count, minimum_stock, reported_total_raw, calculated_total_value,
      calculated_total_unit, received_on, opened_on, expires_on, effective_on,
      approved_by, approved_at
    ) VALUES (
      product_id, current_row.unit_id, 'department', NULL,
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
      p_actor_id, now()
    )
    RETURNING id, to_jsonb(chemical_inventory_holdings.*) INTO holding_id, target_after;

    SELECT version.id INTO sds_version_id
    FROM public.chemical_sds_versions AS version
    WHERE version.product_id = product_id AND version.file_id = source_file_id
    ORDER BY version.created_at DESC
    LIMIT 1;

    IF sds_version_id IS NULL THEN
      INSERT INTO public.chemical_sds_versions (
        product_id, file_id, language, status, created_by
      ) VALUES (
        product_id, source_file_id, 'th', 'draft', current_row.created_by
      )
      RETURNING id INTO sds_version_id;
    END IF;

    INSERT INTO public.chemical_department_chemical_links (
      department_sds_id, product_id, holding_id, sds_version_id, linked_by
    ) VALUES (
      source_department_sds_id, product_id, holding_id, sds_version_id, p_actor_id
    );
  END IF;

  UPDATE public.chemical_change_requests AS request
  SET status = p_decision,
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''),
    updated_at = now()
  WHERE request.id = p_request_id
  RETURNING to_jsonb(request) INTO request_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.department_change_request.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', to_jsonb(current_row), 'after', request_after, 'reason', p_reason,
      'entity_type', current_row.entity_type, 'entity_id', product_id,
      'source_department_sds_id', source_department_sds_id,
      'holding_id', holding_id, 'sds_version_id', sds_version_id,
      'target_after', target_after
    )::text
  );
  RETURN p_request_id;
END;
$$;

-- แก้ปริมาณ/วันของ holding จากงาน โดยคงขอบเขต department และ location เป็น NULL
-- แยกจาก RPC เดิมเพราะ RPC เดิมตรวจ snapshot แบบห้องสารเคมีและบังคับ location_id
CREATE OR REPLACE FUNCTION public.review_chemical_department_holding_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
  target_after jsonb;
  request_after jsonb;
  holding_row public.chemical_inventory_holdings%rowtype;
  holding_keys constant text[] := ARRAY[
    'product_id', 'unit_id', 'storage_scope', 'location_id', 'lot_number',
    'package_value', 'package_unit', 'current_container_count', 'minimum_stock',
    'reported_total_raw', 'calculated_total_value', 'calculated_total_unit',
    'received_on', 'opened_on', 'expires_on', 'effective_on'
  ];
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'holding' THEN
    RAISE EXCEPTION 'invalid_department_holding_change_request';
  END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT * INTO holding_row
    FROM public.chemical_inventory_holdings
    WHERE id = current_row.entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;
    target_before := to_jsonb(holding_row);

    IF holding_row.storage_scope <> 'department'
      OR holding_row.location_id IS NOT NULL
      OR NOT current_row.proposed_data ?& ARRAY[
        'product_id', 'unit_id', 'storage_scope', 'package_value',
        'package_unit', 'current_container_count', 'minimum_stock'
      ]
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(holding_keys))
      )
      OR jsonb_typeof(current_row.proposed_data->'product_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'unit_id') <> 'string'
      OR current_row.proposed_data->>'unit_id' <> current_row.unit_id::text
      OR current_row.proposed_data->>'product_id' <> holding_row.product_id::text
      OR current_row.proposed_data->>'storage_scope' <> 'department'
      OR (current_row.proposed_data ? 'location_id'
        AND jsonb_typeof(current_row.proposed_data->'location_id') <> 'null')
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR jsonb_typeof(current_row.proposed_data->'package_unit') <> 'string'
      OR current_row.proposed_data->>'package_unit' NOT IN ('mL', 'L', 'g', 'kg')
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR floor((current_row.proposed_data->>'current_container_count')::numeric)
        <> (current_row.proposed_data->>'current_container_count')::numeric
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR floor((current_row.proposed_data->>'minimum_stock')::numeric)
        <> (current_row.proposed_data->>'minimum_stock')::numeric
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'lot_number', 'reported_total_raw', 'calculated_total_unit',
          'received_on', 'opened_on', 'expires_on', 'effective_on'
        ])
        AND jsonb_typeof(value) NOT IN ('string', 'null')
      )
      OR (current_row.proposed_data ? 'calculated_total_value'
        AND jsonb_typeof(current_row.proposed_data->'calculated_total_value') NOT IN ('number', 'null'))
      OR (current_row.proposed_data ? 'calculated_total_value'
        AND current_row.proposed_data->>'calculated_total_value' IS NOT NULL
        AND (current_row.proposed_data->>'calculated_total_value')::numeric < 0)
    THEN
      RAISE EXCEPTION 'invalid_department_holding_snapshot';
    END IF;

    UPDATE public.chemical_inventory_holdings AS holding
    SET product_id = holding_row.product_id,
      unit_id = current_row.unit_id,
      storage_scope = 'department',
      location_id = NULL,
      lot_number = current_row.proposed_data->>'lot_number',
      package_value = (current_row.proposed_data->>'package_value')::numeric,
      package_unit = current_row.proposed_data->>'package_unit',
      current_container_count = (current_row.proposed_data->>'current_container_count')::integer,
      minimum_stock = (current_row.proposed_data->>'minimum_stock')::numeric,
      reported_total_raw = current_row.proposed_data->>'reported_total_raw',
      calculated_total_value = (current_row.proposed_data->>'calculated_total_value')::numeric,
      calculated_total_unit = current_row.proposed_data->>'calculated_total_unit',
      received_on = (current_row.proposed_data->>'received_on')::date,
      opened_on = (current_row.proposed_data->>'opened_on')::date,
      expires_on = (current_row.proposed_data->>'expires_on')::date,
      effective_on = (current_row.proposed_data->>'effective_on')::date,
      approved_by = p_actor_id,
      approved_at = now(),
      updated_at = now()
    WHERE holding.id = current_row.entity_id
    RETURNING to_jsonb(holding) INTO target_after;
  END IF;

  UPDATE public.chemical_change_requests AS request
  SET status = p_decision,
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''),
    updated_at = now()
  WHERE request.id = p_request_id
  RETURNING to_jsonb(request) INTO request_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.department_holding_change_request.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', to_jsonb(current_row), 'after', request_after, 'reason', p_reason,
      'entity_type', current_row.entity_type, 'entity_id', current_row.entity_id,
      'target_before', target_before, 'target_after', target_after
    )::text
  );
  RETURN p_request_id;
END;
$$;

-- Product edits from the registry form include the GHS snapshot. Keep this
-- path separate from the legacy RPC so existing holding/new-chemical semantics
-- stay unchanged while old pending requests without GHS keys remain approvable.
CREATE OR REPLACE FUNCTION public.review_chemical_product_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
  target_after jsonb;
  request_after jsonb;
  product_keys constant text[] := ARRAY[
    'canonical_name', 'cas_number', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'physical_state', 'lifecycle_status', 'ghs_source_text',
    'ghs_pictogram_codes', 'ghs_hazard_classes'
  ];
  product_required_keys constant text[] := ARRAY[
    'canonical_name', 'cas_number', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'physical_state', 'lifecycle_status'
  ];
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'product' THEN
    RAISE EXCEPTION 'invalid_product_change_request';
  END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT to_jsonb(product) INTO target_before
    FROM public.chemical_products AS product
    WHERE product.id = current_row.entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'chemical_product_not_found'; END IF;

    IF NOT current_row.proposed_data ?& product_required_keys
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(product_keys))
      )
      OR nullif(btrim(current_row.proposed_data->>'canonical_name'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'canonical_name') <> 'string'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'cas_number', 'manufacturer', 'supplier', 'product_code',
          'concentration', 'physical_state'
        ])
          AND jsonb_typeof(value) NOT IN ('string','null')
      )
      OR current_row.proposed_data->>'lifecycle_status' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'lifecycle_status') <> 'string'
      OR current_row.proposed_data->>'lifecycle_status' NOT IN ('active','retired')
      OR (
        current_row.proposed_data->>'physical_state' IS NOT NULL
        AND current_row.proposed_data->>'physical_state' NOT IN ('solid','liquid','gas','mixture','unknown')
      )
      OR (
        current_row.proposed_data ? 'ghs_source_text'
        AND jsonb_typeof(current_row.proposed_data->'ghs_source_text') NOT IN ('string','null')
      )
      OR (
        current_row.proposed_data ? 'ghs_pictogram_codes'
        AND (
          jsonb_typeof(current_row.proposed_data->'ghs_pictogram_codes') <> 'array'
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS code
            WHERE code NOT IN ('GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09')
          )
        )
      )
      OR (
        current_row.proposed_data ? 'ghs_hazard_classes'
        AND NOT public.chemical_ghs_hazard_classes_valid(current_row.proposed_data->'ghs_hazard_classes')
      )
    THEN RAISE EXCEPTION 'invalid_product_snapshot'; END IF;

    UPDATE public.chemical_products AS product
    SET canonical_name = current_row.proposed_data->>'canonical_name',
      cas_number = current_row.proposed_data->>'cas_number',
      manufacturer = current_row.proposed_data->>'manufacturer',
      supplier = current_row.proposed_data->>'supplier',
      product_code = current_row.proposed_data->>'product_code',
      concentration = current_row.proposed_data->>'concentration',
      physical_state = current_row.proposed_data->>'physical_state',
      lifecycle_status = current_row.proposed_data->>'lifecycle_status',
      ghs_source_text = CASE
        WHEN current_row.proposed_data ? 'ghs_source_text'
          THEN current_row.proposed_data->>'ghs_source_text'
        ELSE product.ghs_source_text
      END,
      ghs_pictogram_codes = CASE
        WHEN current_row.proposed_data ? 'ghs_pictogram_codes' THEN COALESCE(
          (SELECT array_agg(value)
           FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS value),
          ARRAY[]::text[]
        )
        ELSE product.ghs_pictogram_codes
      END,
      ghs_hazard_classes = CASE
        WHEN current_row.proposed_data ? 'ghs_hazard_classes'
          THEN current_row.proposed_data->'ghs_hazard_classes'
        ELSE product.ghs_hazard_classes
      END,
      updated_at = now()
    WHERE product.id = current_row.entity_id
    RETURNING to_jsonb(product) INTO target_after;
  END IF;

  UPDATE public.chemical_change_requests AS request
  SET status = p_decision,
    reviewed_by = p_actor_id,
    reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''),
    updated_at = now()
  WHERE request.id = p_request_id
  RETURNING to_jsonb(request) INTO request_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.change_request.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', to_jsonb(current_row), 'after', request_after, 'reason', p_reason,
      'entity_type', current_row.entity_type, 'entity_id', current_row.entity_id,
      'proposed_data', current_row.proposed_data,
      'target_before', target_before, 'target_after', target_after
    )::text
  );
  RETURN p_request_id;
END;
$$;

-- เก็บ RPC เดิมไว้สำหรับ product/holding/new_chemical แล้วห่อด้วย dispatcher
-- เพื่อเพิ่ม department_chemical โดยไม่เปลี่ยน semantics ของข้อมูลเดิม
DO $$
BEGIN
  IF to_regprocedure('public.review_chemical_change_request(uuid,uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'review_chemical_change_request must exist before this migration';
  END IF;
  IF to_regprocedure('public.review_chemical_change_request_legacy(uuid,uuid,text,text)') IS NULL THEN
    ALTER FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
      RENAME TO review_chemical_change_request_legacy;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_chemical_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE entity_type text;
  holding_scope text;
BEGIN
  SELECT request.entity_type INTO entity_type
  FROM public.chemical_change_requests AS request
  WHERE request.id = p_request_id;

  IF entity_type = 'product' THEN
    RETURN public.review_chemical_product_change_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
  END IF;

  IF entity_type = 'department_chemical' THEN
    RETURN public.review_chemical_department_change_request(
      p_request_id, p_actor_id, p_decision, p_reason
    );
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

REVOKE ALL ON FUNCTION public.review_chemical_product_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_product_change_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_department_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_department_change_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_department_holding_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_department_holding_change_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_change_request_legacy(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_change_request_legacy(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
