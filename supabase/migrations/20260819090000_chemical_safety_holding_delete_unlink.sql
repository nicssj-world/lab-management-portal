-- อนุมัติลบ holding ที่เชื่อมกับ SDS งานได้ โดยถอดเฉพาะลิงก์ทะเบียนออกก่อน
-- SDS, ไฟล์ SDS และประวัติการทบทวนยังคงอยู่ ส่วน SDS version/publication
-- ที่อ้าง holding โดยตรงยังคงถูกป้องกันด้วย FK RESTRICT
BEGIN;

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

REVOKE ALL ON FUNCTION public.review_chemical_holding_delete_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_holding_delete_request(uuid,uuid,text,text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
