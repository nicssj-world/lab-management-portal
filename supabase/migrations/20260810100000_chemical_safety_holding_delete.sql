-- เพิ่มความสามารถ "ลบรายการคลัง" (holding) ออกจากทะเบียนสารเคมี ผ่าน workflow เสนอ→ทบทวน→อนุมัติเดิม
-- ก่อนหน้านี้ทะเบียนมีแค่เพิ่ม/แก้ไข ไม่มีทางลบรายการที่บันทึกผิดหรือเลิกใช้ไปแล้วได้เลย
-- entity_type = 'holding_delete' ใช้ entity_id ชี้ไปที่ holding เดิม เหมือน 'holding' แต่ proposed_data
-- ไม่มีฟิลด์ให้แก้ไข (มีแค่เหตุผลไว้ให้ผู้ทบทวนอ่านประกอบ) เพราะการอนุมัติคือการลบแถวทิ้งไปเลย
BEGIN;

ALTER TABLE public.chemical_change_requests
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_type_check,
  DROP CONSTRAINT IF EXISTS chemical_change_requests_entity_id_required;
ALTER TABLE public.chemical_change_requests
  ADD CONSTRAINT chemical_change_requests_entity_type_check
    CHECK (entity_type IN ('product', 'holding', 'new_chemical', 'department_chemical', 'registry_entry', 'holding_delete')),
  ADD CONSTRAINT chemical_change_requests_entity_id_required CHECK (
    (entity_type IN ('new_chemical', 'department_chemical') AND entity_id IS NULL)
    OR (
      entity_type = 'registry_entry'
      AND (
        (status IN ('draft', 'in_review', 'rejected') AND entity_id IS NULL)
        OR (status = 'approved' AND entity_id IS NOT NULL)
      )
    )
    OR (entity_type IN ('product', 'holding', 'holding_delete') AND entity_id IS NOT NULL)
  );

-- ลบ holding จริงตอนอนุมัติ ไม่สนใจ storage_scope (ลบได้ทั้งของห้องและของงาน)
-- ถ้ามี SDS version/publication หรือ department link อ้างอิง holding นี้อยู่ FK RESTRICT จะกันไว้
-- (chemical_department_chemical_links.holding_id, chemical_sds_versions.source_holding_id,
-- chemical_sds_publications.source_holding_id) — จับ foreign_key_violation แล้วแปลงเป็น error ที่สื่อความหมาย
-- แทนที่จะปล่อยให้หลุดเป็น raw constraint violation
CREATE OR REPLACE FUNCTION public.review_chemical_holding_delete_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
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
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
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
      'target_before', target_before, 'target_after', NULL
    )::text
  );
  RETURN p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_chemical_holding_delete_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_holding_delete_request(uuid,uuid,text,text)
  TO service_role;

-- ต่อ dispatcher เดิม (จาก 20260809085841_registry_first_sds_workflow.sql) ให้รู้จัก holding_delete
-- ก่อนตกไปที่ fallback legacy — legacy ไม่มีสาขานี้ จะปิดคำขอเป็น approved โดยไม่ลบอะไรจริงถ้าไม่ดักไว้ก่อน
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
  IF entity_type = 'holding_delete' THEN
    RETURN public.review_chemical_holding_delete_request(
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

NOTIFY pgrst, 'reload schema';
COMMIT;
