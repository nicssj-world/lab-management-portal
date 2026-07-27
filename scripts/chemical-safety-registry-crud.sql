-- เพิ่ม/แก้ไข/เลิกใช้งานสารเคมีในทะเบียนห้องเก็บสารเคมี ผ่าน workflow เสนอ→ทบทวน→อนุมัติเดิม
-- รันหลัง scripts/chemical-safety-ghs-and-departments.sql
--
-- ก่อนหน้านี้ chemical_change_requests รองรับเฉพาะ "แก้ไขของที่มีอยู่แล้ว" (entity_id บังคับ NOT NULL)
-- ไม่มีทางเพิ่มสารเคมีใหม่เข้าทะเบียนได้เลย จึงเพิ่ม entity_type = 'new_chemical' ที่ entity_id เป็น NULL
-- แล้วตอนอนุมัติจะสร้าง product + unit_product + holding พร้อมกันในคำขอเดียว
BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. entity_id ต้องเป็น NULL ได้ (เฉพาะตอนสร้างใหม่) และ entity_type ต้องรับ 'new_chemical'
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chemical_change_requests ALTER COLUMN entity_id DROP NOT NULL;

DO $$
DECLARE constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.chemical_change_requests'::regclass
      AND contype = 'c'
      AND (
        pg_get_constraintdef(oid) LIKE '%entity_type = ANY%'
        OR pg_get_constraintdef(oid) LIKE '%entity_type IN%'
      )
  LOOP
    EXECUTE format(
      'ALTER TABLE public.chemical_change_requests DROP CONSTRAINT %I', constraint_name
    );
  END LOOP;
END;
$$;

ALTER TABLE public.chemical_change_requests
  ADD CONSTRAINT chemical_change_requests_entity_type_check
    CHECK (entity_type IN ('product', 'holding', 'new_chemical'));

ALTER TABLE public.chemical_change_requests
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_id_required;
ALTER TABLE public.chemical_change_requests
  ADD CONSTRAINT chemical_change_requests_entity_id_required CHECK (
    (entity_type = 'new_chemical' AND entity_id IS NULL)
    OR (entity_type IN ('product', 'holding') AND entity_id IS NOT NULL)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. แทนที่ review_chemical_change_request ทั้งฟังก์ชัน เพิ่มสาขา 'new_chemical'
--
-- สาขา 'product' และ 'holding' คัดลอกมาจากต้นฉบับทุกตัวอักษร ไม่มีการเปลี่ยนแปลง
-- เพิ่มเฉพาะสาขาใหม่สำหรับสร้างสารเคมีใหม่ทั้งชุด (product + unit_product + holding)
--
-- จงใจไม่รับคีย์ GHS (ghs_pictogram_codes ฯลฯ) ในการ "แก้ไข" ผ่านเส้นทางนี้ เพราะ GHS
-- ของสารที่มีอยู่แล้วมาจาก master list/SDS อยู่แล้ว แต่ตอน "สร้างใหม่" ยอมให้กรอกได้
-- เนื่องจากสารที่เพิ่มเองไม่มี master list ให้แปลงอัตโนมัติ
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.review_chemical_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
  target_after jsonb;
  request_after jsonb;
  new_product_id uuid;
  product_keys constant text[] := ARRAY[
    'canonical_name', 'cas_number', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'physical_state', 'lifecycle_status'
  ];
  holding_keys constant text[] := ARRAY[
    'product_id', 'unit_id', 'location_id', 'lot_number', 'package_value',
    'package_unit', 'current_container_count', 'minimum_stock', 'reported_total_raw',
    'calculated_total_value', 'calculated_total_unit', 'received_on', 'opened_on',
    'expires_on', 'effective_on'
  ];
  new_chemical_required_keys constant text[] := ARRAY[
    'canonical_name', 'location_id', 'package_value', 'package_unit',
    'current_container_count', 'minimum_stock'
  ];
  new_chemical_all_keys constant text[] := ARRAY[
    'canonical_name', 'cas_number', 'manufacturer', 'supplier', 'product_code', 'concentration',
    'physical_state', 'aliases', 'location_id', 'lot_number', 'package_value', 'package_unit',
    'current_container_count', 'minimum_stock', 'reported_total_raw', 'calculated_total_value',
    'calculated_total_unit', 'received_on', 'opened_on', 'expires_on', 'effective_on',
    'ghs_source_text', 'ghs_pictogram_codes', 'ghs_hazard_classes'
  ];
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' AND current_row.entity_type = 'product' THEN
    SELECT to_jsonb(product) INTO target_before
    FROM public.chemical_products AS product
    WHERE product.id = current_row.entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'chemical_product_not_found'; END IF;

    IF NOT current_row.proposed_data ?& product_keys
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
      updated_at = now()
    WHERE product.id = current_row.entity_id
    RETURNING to_jsonb(product) INTO target_after;
  ELSIF p_decision = 'approved' AND current_row.entity_type = 'holding' THEN
    SELECT to_jsonb(holding) INTO target_before
    FROM public.chemical_inventory_holdings AS holding
    WHERE holding.id = current_row.entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;

    IF NOT current_row.proposed_data ?& holding_keys
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(holding_keys))
      )
      OR nullif(btrim(current_row.proposed_data->>'product_id'), '') IS NULL
      OR nullif(btrim(current_row.proposed_data->>'unit_id'), '') IS NULL
      OR nullif(btrim(current_row.proposed_data->>'location_id'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'product_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'unit_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'location_id') <> 'string'
      OR current_row.proposed_data->>'package_value' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR nullif(btrim(current_row.proposed_data->>'package_unit'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'package_unit') <> 'string'
      OR current_row.proposed_data->>'current_container_count' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR current_row.proposed_data->>'minimum_stock' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'lot_number', 'reported_total_raw', 'calculated_total_unit',
          'received_on', 'opened_on', 'expires_on', 'effective_on'
        ])
          AND jsonb_typeof(value) NOT IN ('string','null')
      )
      OR jsonb_typeof(current_row.proposed_data->'calculated_total_value') NOT IN ('number','null')
      OR (current_row.proposed_data->>'unit_id')::uuid <> current_row.unit_id
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
      OR (
        current_row.proposed_data->>'calculated_total_value' IS NOT NULL
        AND (current_row.proposed_data->>'calculated_total_value')::numeric < 0
      )
    THEN RAISE EXCEPTION 'invalid_holding_snapshot'; END IF;

    UPDATE public.chemical_inventory_holdings AS holding
    SET product_id = (current_row.proposed_data->>'product_id')::uuid,
      unit_id = (current_row.proposed_data->>'unit_id')::uuid,
      location_id = (current_row.proposed_data->>'location_id')::uuid,
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
      approved_by = p_actor_id, approved_at = now(), updated_at = now()
    WHERE holding.id = current_row.entity_id
    RETURNING to_jsonb(holding) INTO target_after;
  ELSIF p_decision = 'approved' AND current_row.entity_type = 'new_chemical' THEN
    IF NOT current_row.proposed_data ?& new_chemical_required_keys
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(new_chemical_all_keys))
      )
      OR nullif(btrim(current_row.proposed_data->>'canonical_name'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'canonical_name') <> 'string'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'cas_number', 'manufacturer', 'supplier', 'product_code', 'concentration',
          'physical_state', 'lot_number', 'reported_total_raw', 'calculated_total_unit',
          'received_on', 'opened_on', 'expires_on', 'effective_on', 'ghs_source_text'
        ])
          AND jsonb_typeof(value) NOT IN ('string','null')
      )
      OR (
        current_row.proposed_data->>'physical_state' IS NOT NULL
        AND current_row.proposed_data->>'physical_state' NOT IN ('solid','liquid','gas','mixture','unknown')
      )
      OR nullif(btrim(current_row.proposed_data->>'location_id'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'location_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR nullif(btrim(current_row.proposed_data->>'package_unit'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'package_unit') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
      OR (
        current_row.proposed_data->>'calculated_total_value' IS NOT NULL
        AND (
          jsonb_typeof(current_row.proposed_data->'calculated_total_value') <> 'number'
          OR (current_row.proposed_data->>'calculated_total_value')::numeric < 0
        )
      )
      OR (
        current_row.proposed_data ? 'aliases'
        AND (
          jsonb_typeof(current_row.proposed_data->'aliases') <> 'array'
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(current_row.proposed_data->'aliases') AS alias
            WHERE jsonb_typeof(alias) <> 'string' OR nullif(btrim(alias #>> '{}'), '') IS NULL
          )
        )
      )
      OR (
        current_row.proposed_data ? 'ghs_pictogram_codes'
        AND (
          jsonb_typeof(current_row.proposed_data->'ghs_pictogram_codes') <> 'array'
          OR EXISTS (
            SELECT 1 FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS code
            WHERE code NOT IN ('GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09')
          )
        )
      )
      OR (
        current_row.proposed_data ? 'ghs_hazard_classes'
        AND NOT public.chemical_ghs_hazard_classes_valid(current_row.proposed_data->'ghs_hazard_classes')
      )
    THEN RAISE EXCEPTION 'invalid_new_chemical_snapshot'; END IF;

    -- ตำแหน่งจัดเก็บต้องมีอยู่จริง (FK ของ chemical_inventory_holdings จะกันไว้อีกชั้นอยู่แล้ว
    -- แต่เช็คตรงนี้ก่อนเพื่อให้ได้ error ที่สื่อความหมายชัดกว่า foreign key violation ดิบ ๆ)
    IF NOT EXISTS (
      SELECT 1 FROM public.chemical_storage_locations
      WHERE id = (current_row.proposed_data->>'location_id')::uuid
    ) THEN RAISE EXCEPTION 'chemical_location_not_found'; END IF;

    INSERT INTO public.chemical_products (
      canonical_name, cas_number, manufacturer, supplier, product_code, concentration,
      physical_state, lifecycle_status, ghs_source_text, ghs_pictogram_codes,
      ghs_hazard_classes, created_by
    ) VALUES (
      current_row.proposed_data->>'canonical_name',
      current_row.proposed_data->>'cas_number',
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
    RETURNING id INTO new_product_id;

    IF current_row.proposed_data ? 'aliases' THEN
      INSERT INTO public.chemical_product_aliases (product_id, alias, normalized_alias)
      SELECT new_product_id, alias.value, lower(btrim(alias.value))
      FROM jsonb_array_elements_text(current_row.proposed_data->'aliases') AS alias(value)
      WHERE nullif(btrim(alias.value), '') IS NOT NULL
      ON CONFLICT (product_id, normalized_alias) DO NOTHING;
    END IF;

    INSERT INTO public.chemical_unit_products (product_id, unit_id, preferred_name, active, public_eligible)
    VALUES (new_product_id, current_row.unit_id, current_row.proposed_data->>'canonical_name', true, true);

    INSERT INTO public.chemical_inventory_holdings (
      product_id, unit_id, location_id, lot_number, package_value, package_unit,
      current_container_count, minimum_stock, reported_total_raw, calculated_total_value,
      calculated_total_unit, received_on, opened_on, expires_on, effective_on,
      approved_by, approved_at
    ) VALUES (
      new_product_id, current_row.unit_id, (current_row.proposed_data->>'location_id')::uuid,
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
    RETURNING to_jsonb(chemical_inventory_holdings.*) INTO target_after;

    target_before := NULL;
  END IF;

  UPDATE public.chemical_change_requests AS request
  SET status = p_decision, reviewed_by = p_actor_id, reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''), updated_at = now()
  WHERE request.id = p_request_id
  RETURNING to_jsonb(request) INTO request_after;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.change_request.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', to_jsonb(current_row), 'after', request_after, 'reason', p_reason,
      'entity_type', current_row.entity_type, 'entity_id', COALESCE(current_row.entity_id, new_product_id),
      'proposed_data', current_row.proposed_data,
      'target_before', target_before, 'target_after', target_after
    )::text
  );
  RETURN p_request_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
