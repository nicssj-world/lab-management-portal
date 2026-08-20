-- ปิดระบบ "รออนุมัติ" ของ SDS และของคำขอแก้ไขทะเบียนสารเคมี
--
-- เดิมมีด่านรออนุมัติซ้อนกัน 3 ชั้นก่อน SDS จะขึ้นระบบได้
--   1) draft -> in_review -> approved  (ผู้ส่งอนุมัติของตัวเองไม่ได้ ต้องมีคนที่ 2 เสมอ)
--   2) approved -> เชื่อม publication  (link_chemical_sds_publication บังคับ status = 'approved')
--   3) หัวหน้างานกดเผยแพร่ SDS ทั้งชุดของงาน
-- migration นี้ปิดด่าน 1 และ 2 — ด่าน 3 ยังคงอยู่ตามที่ตกลงไว้
--
-- หลังจากนี้ SDS 1 สาร มีแถวใช้งานได้แถวเดียว แก้ทับไปเรื่อย ๆ ไม่สร้างเวอร์ชันใหม่
-- แถวประวัติเดิมที่เป็น superseded ไม่ถูกลบ (เป็นบันทึกคุณภาพ) แค่ไม่ถูกแสดงอีกต่อไป
--
-- รันด้วยมือที่ Supabase Dashboard -> SQL Editor (โปรเจกต์นี้ไม่มี migration runner อัตโนมัติ)

BEGIN;

-- กันการรันผิดลำดับ: ฟังก์ชันที่ migration นี้จะเขียนทับต้องมีอยู่แล้วทุกตัว
DO $guard$
DECLARE missing text;
BEGIN
  FOR missing IN
    SELECT signature FROM unnest(ARRAY[
      'public.update_chemical_sds_draft(uuid,uuid,timestamptz,jsonb,jsonb)',
      'public.review_chemical_change_request_legacy(uuid,uuid,text,text)',
      'public.review_chemical_product_change_request(uuid,uuid,text,text)',
      'public.review_chemical_department_change_request(uuid,uuid,text,text)',
      'public.review_chemical_department_holding_change_request(uuid,uuid,text,text)',
      'public.review_chemical_registry_entry_request(uuid,uuid,text,text)',
      'public.review_chemical_holding_delete_request(uuid,uuid,text,text)'
    ]) AS signature
    WHERE to_regprocedure(signature) IS NULL
  LOOP
    RAISE EXCEPTION 'missing function %, run the earlier chemical-safety scripts first', missing;
  END LOOP;
END;
$guard$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SDS: ถอด constraint ที่มีไว้บังคับ workflow อนุมัติเท่านั้น
--
-- chemical_sds_workflow_coherent บังคับว่า status = 'approved' ต้องมี submitted_by
-- และ reviewed_by ครบ ซึ่งเป็นไปไม่ได้แล้วเมื่อไม่มีขั้นตอนส่ง/ทบทวน
-- chemical_sds_no_self_review บังคับว่าผู้ทบทวนต้องคนละคนกับผู้ส่ง
--
-- ไม่แตะ CHECK ของคอลัมน์ status — ค่า in_review/rejected ยังถูกต้องตามชนิดข้อมูล
-- เพียงแต่จะไม่มีอะไรสร้างค่าพวกนั้นขึ้นมาอีก
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.chemical_sds_versions
  DROP CONSTRAINT IF EXISTS chemical_sds_no_self_review,
  DROP CONSTRAINT IF EXISTS chemical_sds_workflow_coherent;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. แก้ SDS ฉบับที่ใช้งานอยู่ได้โดยตรง ไม่ต้องเปิดฉบับร่างใหม่
-- ─────────────────────────────────────────────────────────────────────────────

-- update_chemical_sds_draft
-- คัดลอกจาก scripts/chemical-safety-module.sql:638 แก้ 2 จุดตามคอมเมนต์ในบอดี้ นอกนั้นคงเดิม
CREATE OR REPLACE FUNCTION public.update_chemical_sds_draft(
  p_version_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz,
  p_metadata jsonb, p_hazards jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_sds_versions%rowtype;
  metadata_keys constant text[] := ARRAY[
    'file_id', 'source_url', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'language', 'revision_label', 'effective_on', 'review_due_on',
    'signal_word', 'pictogram_codes', 'h_statements', 'p_statements',
    'storage_instructions', 'incompatibilities', 'emergency_summary'
  ];
  metadata_text_keys constant text[] := ARRAY[
    'file_id', 'source_url', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'language', 'revision_label', 'effective_on', 'review_due_on',
    'signal_word', 'storage_instructions', 'incompatibilities', 'emergency_summary'
  ];
  before_detail jsonb;
  after_detail jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  -- เดิม: แก้ได้เฉพาะ status = 'draft' — ตอนนี้ฉบับที่ใช้งานอยู่ต้องแก้ทับได้ด้วย
  IF current_row.status NOT IN ('draft', 'approved') THEN RAISE EXCEPTION 'sds_not_editable'; END IF;
  -- เดิม: เฉพาะผู้สร้าง/ผู้ส่งเท่านั้นที่แก้ได้ — ตัดออกเพราะไม่มีเจ้าของฉบับร่างแล้ว
  -- สิทธิ์ถูกกันที่ route ด้วย requireChemicalCustodian(unitId) อยู่แล้ว
  IF current_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'stale_sds_draft';
  END IF;
  IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_metadata) AS metadata_key(key)
      WHERE NOT (key = ANY(metadata_keys))
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_each(p_metadata) AS metadata_value(key, value)
      WHERE key = ANY(metadata_text_keys)
        AND jsonb_typeof(value) NOT IN ('string','null')
    )
    OR (p_metadata ? 'pictogram_codes' AND jsonb_typeof(p_metadata->'pictogram_codes') IS DISTINCT FROM 'array')
    OR (p_metadata ? 'h_statements' AND jsonb_typeof(p_metadata->'h_statements') IS DISTINCT FROM 'array')
    OR (p_metadata ? 'p_statements' AND jsonb_typeof(p_metadata->'p_statements') IS DISTINCT FROM 'array')
  THEN RAISE EXCEPTION 'invalid_sds_metadata'; END IF;

  IF p_metadata ? 'pictogram_codes' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'pictogram_codes') AS pictogram(code)
    WHERE jsonb_typeof(code) <> 'string'
      OR code #>> '{}' NOT IN (
        'GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09'
      )
  ) THEN RAISE EXCEPTION 'invalid_pictogram_codes'; END IF;

  IF p_metadata ? 'h_statements' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'h_statements') AS statement
    WHERE jsonb_typeof(statement) <> 'object'
      OR NOT statement ?& ARRAY['code','text']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
        WHERE key NOT IN ('code','text')
      )
      OR jsonb_typeof(statement->'code') <> 'string'
      OR jsonb_typeof(statement->'text') <> 'string'
      OR statement->>'code' !~ '^H[0-9]{3}$'
      OR nullif(btrim(statement->>'text'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_h_statements'; END IF;

  IF p_metadata ? 'p_statements' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'p_statements') AS statement
    WHERE jsonb_typeof(statement) <> 'object'
      OR NOT statement ?& ARRAY['code','text']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
        WHERE key NOT IN ('code','text')
      )
      OR jsonb_typeof(statement->'code') <> 'string'
      OR jsonb_typeof(statement->'text') <> 'string'
      OR statement->>'code' !~ '^P[0-9]{3}$'
      OR nullif(btrim(statement->>'text'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_p_statements'; END IF;

  IF jsonb_typeof(p_hazards) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_hazards) AS hazard
    WHERE jsonb_typeof(hazard) <> 'object'
      OR NOT hazard ?& ARRAY['hazard_class','hazard_category']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(hazard) AS hazard_key(key)
        WHERE key NOT IN ('hazard_class','hazard_category')
      )
      OR nullif(btrim(hazard->>'hazard_class'), '') IS NULL
      OR nullif(btrim(hazard->>'hazard_category'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_sds_hazards'; END IF;

  before_detail := to_jsonb(current_row) || jsonb_build_object(
    'hazards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'hazard_class', hazard_class, 'hazard_category', hazard_category
      ) ORDER BY hazard_class, hazard_category)
      FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id
    ), '[]'::jsonb)
  );

  UPDATE public.chemical_sds_versions
  SET file_id = CASE WHEN p_metadata ? 'file_id' THEN (p_metadata->>'file_id')::uuid ELSE file_id END,
    source_url = CASE WHEN p_metadata ? 'source_url' THEN p_metadata->>'source_url' ELSE source_url END,
    manufacturer = CASE WHEN p_metadata ? 'manufacturer' THEN p_metadata->>'manufacturer' ELSE manufacturer END,
    supplier = CASE WHEN p_metadata ? 'supplier' THEN p_metadata->>'supplier' ELSE supplier END,
    product_code = CASE WHEN p_metadata ? 'product_code' THEN p_metadata->>'product_code' ELSE product_code END,
    concentration = CASE WHEN p_metadata ? 'concentration' THEN p_metadata->>'concentration' ELSE concentration END,
    language = CASE WHEN p_metadata ? 'language' THEN p_metadata->>'language' ELSE language END,
    revision_label = CASE WHEN p_metadata ? 'revision_label' THEN p_metadata->>'revision_label' ELSE revision_label END,
    effective_on = CASE WHEN p_metadata ? 'effective_on' THEN (p_metadata->>'effective_on')::date ELSE effective_on END,
    review_due_on = CASE WHEN p_metadata ? 'review_due_on' THEN (p_metadata->>'review_due_on')::date ELSE review_due_on END,
    signal_word = CASE WHEN p_metadata ? 'signal_word' THEN p_metadata->>'signal_word' ELSE signal_word END,
    pictogram_codes = CASE WHEN p_metadata ? 'pictogram_codes' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_metadata->'pictogram_codes')) ELSE pictogram_codes END,
    h_statements = CASE WHEN p_metadata ? 'h_statements' THEN p_metadata->'h_statements' ELSE h_statements END,
    p_statements = CASE WHEN p_metadata ? 'p_statements' THEN p_metadata->'p_statements' ELSE p_statements END,
    storage_instructions = CASE WHEN p_metadata ? 'storage_instructions' THEN p_metadata->>'storage_instructions' ELSE storage_instructions END,
    incompatibilities = CASE WHEN p_metadata ? 'incompatibilities' THEN p_metadata->>'incompatibilities' ELSE incompatibilities END,
    emergency_summary = CASE WHEN p_metadata ? 'emergency_summary' THEN p_metadata->>'emergency_summary' ELSE emergency_summary END,
    updated_at = now()
  WHERE id = p_version_id;

  DELETE FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id;
  INSERT INTO public.chemical_sds_hazards (sds_version_id, hazard_class, hazard_category)
  SELECT p_version_id, hazard->>'hazard_class', hazard->>'hazard_category'
  FROM jsonb_array_elements(p_hazards) AS hazard;

  SELECT to_jsonb(version_row) || jsonb_build_object(
    'hazards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'hazard_class', hazard_class, 'hazard_category', hazard_category
      ) ORDER BY hazard_class, hazard_category)
      FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id
    ), '[]'::jsonb)
  ) INTO after_detail
  FROM public.chemical_sds_versions AS version_row
  WHERE version_row.id = p_version_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.draft_update', p_actor_id, p_version_id::text,
    jsonb_build_object('before', before_detail, 'after', after_detail)::text
  );
  RETURN p_version_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. publish_chemical_sds — แทนที่คู่ submit + review เดิมด้วยขั้นตอนเดียว
--
-- เรียกหลังบันทึกข้อมูลหรืออัปโหลดไฟล์เสร็จ ถ้ามีไฟล์แล้วจะให้ใช้งานได้ทันที
-- และดึง publication ที่ยัง active ของสารตัวนั้นให้มาชี้ฉบับนี้ เพื่อรักษาหลักที่ว่า
-- "1 สาร = SDS ที่ใช้งานได้ 1 ฉบับ" ซึ่ง uq_chemical_sds_one_approved_per_product
-- บังคับอยู่แล้วในระดับตาราง
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.publish_chemical_sds(
  p_version_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_row public.chemical_sds_versions%rowtype;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row FROM public.chemical_sds_versions
    WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;

  -- ล็อกที่ระดับสาร ป้องกันสองคนกดบันทึกคนละฉบับของสารเดียวกันพร้อมกัน
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-product:' || current_row.product_id::text, 0
  ));

  SELECT * INTO current_row FROM public.chemical_sds_versions
    WHERE id = p_version_id FOR UPDATE;
  IF current_row.file_id IS NULL THEN RAISE EXCEPTION 'sds_file_required'; END IF;

  IF current_row.status <> 'approved' THEN
    -- ต้องลดฉบับเดิมลงก่อนค่อยยกฉบับใหม่ขึ้น มิฉะนั้นชน unique index ระหว่างคำสั่ง
    UPDATE public.chemical_sds_versions
    SET status = 'superseded', updated_at = now()
    WHERE product_id = current_row.product_id
      AND status = 'approved'
      AND id <> p_version_id;

    UPDATE public.chemical_sds_versions
    SET status = 'approved', updated_at = now()
    WHERE id = p_version_id;
  END IF;

  UPDATE public.chemical_sds_publications
  SET sds_version_id = p_version_id
  WHERE product_id = current_row.product_id
    AND status = 'active'
    AND sds_version_id <> p_version_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.publish', p_actor_id, p_version_id::text,
    jsonb_build_object(
      'before', current_row.status, 'after', 'approved',
      'product_id', current_row.product_id
    )::text
  );
  RETURN p_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_chemical_sds(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_chemical_sds(uuid,uuid)
  TO service_role;

-- ไม่มี route ไหนเรียกสองตัวนี้อีกแล้ว (ลบ /sds/[id]/submit และ /sds/[id]/review ไปพร้อมกัน)
DROP FUNCTION IF EXISTS public.submit_chemical_sds_version(uuid,uuid);
DROP FUNCTION IF EXISTS public.review_chemical_sds_version(uuid,uuid,text,text);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. คำขอแก้ไขทะเบียน: ถอดเงื่อนไข "ผู้ส่งอนุมัติเองไม่ได้" ออกจาก RPC ปลายทาง
--
-- dispatcher review_chemical_change_request ไม่มีเงื่อนไขนี้ จึงไม่ต้องแตะ
-- ทุกฟังก์ชันด้านล่างคัดลอกมาทั้งตัวจากนิยามล่าสุด ตัดออกฟังก์ชันละ 1 บรรทัดเท่านั้น
-- ─────────────────────────────────────────────────────────────────────────────

-- review_chemical_registry_entry_request
-- คัดลอกจาก supabase/migrations/20260809085841_registry_first_sds_workflow.sql:180 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
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

-- review_chemical_holding_delete_request
-- คัดลอกจาก supabase/migrations/20260819090000_chemical_safety_holding_delete_unlink.sql:6 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
CREATE OR REPLACE FUNCTION public.review_chemical_holding_delete_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
  department_link_before jsonb;
  request_after jsonb;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'holding_delete' THEN
    RAISE EXCEPTION 'invalid_holding_delete_request';
  END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF p_decision IS NULL OR p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;
  IF p_decision = 'rejected' AND nullif(btrim(p_reason), '') IS NULL THEN
    RAISE EXCEPTION 'rejection_reason_required';
  END IF;

  IF p_decision = 'approved' THEN
    SELECT to_jsonb(holding) INTO target_before
    FROM public.chemical_inventory_holdings AS holding
    WHERE holding.id = current_row.entity_id
    FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;

    -- A department link is the registry association being removed. Keep the
    -- source SDS and its file/history; only remove the link that blocks the
    -- holding delete because its FK is intentionally RESTRICT.
    DELETE FROM public.chemical_department_chemical_links AS link
    WHERE link.holding_id = current_row.entity_id
    RETURNING to_jsonb(link) INTO department_link_before;

    BEGIN
      DELETE FROM public.chemical_inventory_holdings WHERE id = current_row.entity_id;
    EXCEPTION WHEN foreign_key_violation THEN
      RAISE EXCEPTION 'holding_in_use_cannot_delete';
    END;
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
      'entity_type', current_row.entity_type, 'entity_id', current_row.entity_id,
      'target_before', target_before, 'target_after', NULL,
      'department_link_before', department_link_before
    )::text
  );
  RETURN p_request_id;
END;
$$;

-- review_chemical_product_change_request
-- คัดลอกจาก scripts/chemical-safety-department-registry.sql:536 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
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

-- review_chemical_department_change_request
-- คัดลอกจาก scripts/chemical-safety-department-registry.sql:110 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
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

-- review_chemical_department_holding_change_request
-- คัดลอกจาก scripts/chemical-safety-department-registry.sql:396 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
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

-- review_chemical_change_request_legacy
-- คัดลอกจาก scripts/chemical-safety-registry-crud.sql:55 ทั้งฟังก์ชัน ตัดออกบรรทัดเดียวคือ
--   IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
-- (ต้นฉบับชื่อ review_chemical_change_request ถูก ALTER ... RENAME TO review_chemical_change_request_legacy ใน chemical-safety-department-registry.sql)
CREATE OR REPLACE FUNCTION public.review_chemical_change_request_legacy(
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
    'concentration', 'physical_state', 'lifecycle_status', 'ghs_source_text',
    'ghs_pictogram_codes', 'ghs_hazard_classes'
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
          'concentration', 'physical_state', 'ghs_source_text'
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
        jsonb_typeof(current_row.proposed_data->'ghs_pictogram_codes') <> 'array'
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS code
          WHERE code NOT IN ('GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09')
        )
      )
      OR NOT public.chemical_ghs_hazard_classes_valid(current_row.proposed_data->'ghs_hazard_classes')
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
      ghs_source_text = current_row.proposed_data->>'ghs_source_text',
      ghs_pictogram_codes = COALESCE(
        (SELECT array_agg(value) FROM jsonb_array_elements_text(current_row.proposed_data->'ghs_pictogram_codes') AS value),
        ARRAY[]::text[]
      ),
      ghs_hazard_classes = current_row.proposed_data->'ghs_hazard_classes',
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. ข้อมูลเดิม
--
-- ฉบับที่แนบไฟล์ไว้แล้วแต่ค้างอยู่ที่ draft/in_review/rejected ให้ใช้งานได้ทันที
-- ต่อ 1 สารเลือกแถวที่ updated_at ใหม่สุดเป็นฉบับใช้งาน ที่เหลือเป็น superseded
-- แยกเป็นสองคำสั่งเพราะ uq_chemical_sds_one_approved_per_product ตรวจระหว่างคำสั่ง
-- ─────────────────────────────────────────────────────────────────────────────
WITH ranked AS (
  SELECT id, row_number() OVER (
      PARTITION BY product_id ORDER BY updated_at DESC, created_at DESC, id
    ) AS position
  FROM public.chemical_sds_versions
  WHERE file_id IS NOT NULL
    AND status IN ('draft', 'in_review', 'rejected', 'approved')
)
UPDATE public.chemical_sds_versions AS version
SET status = 'superseded', updated_at = now()
FROM ranked
WHERE version.id = ranked.id
  AND ranked.position > 1
  AND version.status <> 'superseded';

WITH ranked AS (
  SELECT id, row_number() OVER (
      PARTITION BY product_id ORDER BY updated_at DESC, created_at DESC, id
    ) AS position
  FROM public.chemical_sds_versions
  WHERE file_id IS NOT NULL
    AND status IN ('draft', 'in_review', 'rejected', 'approved')
)
UPDATE public.chemical_sds_versions AS version
SET status = 'approved', updated_at = now()
FROM ranked
WHERE version.id = ranked.id
  AND ranked.position = 1
  AND version.status <> 'approved';

-- ฉบับที่ไม่มีไฟล์ ไม่มีทางใช้งานได้ ให้กลับไปเป็นฉบับร่างที่รอแนบไฟล์
UPDATE public.chemical_sds_versions
SET status = 'draft', updated_at = now()
WHERE file_id IS NULL
  AND status IN ('in_review', 'rejected');

-- publication ที่ยัง active ต้องชี้ฉบับที่ใช้งานอยู่ของสารนั้น
-- ถ้าไม่ทำ ฉบับที่เพิ่งถูกลดเป็น superseded จะทำให้เอกสารหายจากหน้าสาธารณะ
-- (public.ts กรอง chemical_sds_versions ด้วย status = 'approved' ทุกจุด)
UPDATE public.chemical_sds_publications AS publication
SET sds_version_id = live.id
FROM public.chemical_sds_versions AS live
WHERE live.status = 'approved'
  AND publication.product_id = live.product_id
  AND publication.status = 'active'
  AND publication.sds_version_id <> live.id;

COMMIT;

NOTIFY pgrst, 'reload schema';
