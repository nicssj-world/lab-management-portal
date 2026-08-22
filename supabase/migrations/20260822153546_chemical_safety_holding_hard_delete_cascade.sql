-- ให้การลบจากทะเบียนเป็น hard delete ของ holding และ SDS metadata ที่เป็นของ holding เดียวกัน
-- chemical_products และ chemical_unit_products เป็น master data จึงตั้งใจเก็บไว้เสมอ
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_chemical_holding_cascade(
  p_holding_id uuid,
  p_actor_id uuid
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  target_holding public.chemical_inventory_holdings%rowtype;
  version_row public.chemical_sds_versions%rowtype;
  link_row public.chemical_department_chemical_links%rowtype;
  publication_row public.chemical_sds_publications%rowtype;
  department_sds_row public.chemical_department_sds%rowtype;
  file_row public.chemical_sds_files%rowtype;
  candidate_version_ids uuid[] := ARRAY[]::uuid[];
  delete_version_ids uuid[] := ARRAY[]::uuid[];
  detach_version_ids uuid[] := ARRAY[]::uuid[];
  target_link_ids uuid[] := ARRAY[]::uuid[];
  target_department_sds_ids uuid[] := ARRAY[]::uuid[];
  target_publication_ids uuid[] := ARRAY[]::uuid[];
  orphan_file_ids uuid[] := ARRAY[]::uuid[];
  orphan_file_keys text[] := ARRAY[]::text[];
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;

  SELECT * INTO target_holding
  FROM public.chemical_inventory_holdings
  WHERE id = p_holding_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'chemical_holding_not_found';
  END IF;

  -- Lock every direct holding relation before calculating the deletion plan.
  -- Shared SDS rows are retained; only the target holding's publications and
  -- department links are removed.
  FOR link_row IN
    SELECT *
    FROM public.chemical_department_chemical_links
    WHERE holding_id = p_holding_id
    ORDER BY id
    FOR UPDATE
  LOOP
    target_link_ids := array_append(target_link_ids, link_row.id);
    target_department_sds_ids := array_append(target_department_sds_ids, link_row.department_sds_id);
    IF link_row.sds_version_id IS NOT NULL THEN
      candidate_version_ids := array_append(candidate_version_ids, link_row.sds_version_id);
    END IF;
  END LOOP;

  FOR publication_row IN
    SELECT *
    FROM public.chemical_sds_publications
    WHERE source_holding_id = p_holding_id
    ORDER BY id
    FOR UPDATE
  LOOP
    target_publication_ids := array_append(target_publication_ids, publication_row.id);
    candidate_version_ids := array_append(candidate_version_ids, publication_row.sds_version_id);
  END LOOP;

  FOR version_row IN
    SELECT *
    FROM public.chemical_sds_versions
    WHERE source_holding_id = p_holding_id
    ORDER BY id
    FOR UPDATE
  LOOP
    candidate_version_ids := array_append(candidate_version_ids, version_row.id);
  END LOOP;

  candidate_version_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(candidate_version_ids) AS array_item(value)
  );
  target_link_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(target_link_ids) AS array_item(value)
  );
  target_department_sds_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(target_department_sds_ids) AS array_item(value)
  );
  target_publication_ids := ARRAY(
    SELECT DISTINCT value
    FROM unnest(target_publication_ids) AS array_item(value)
  );

  -- Lock the complete dependency set before calculating which versions can be
  -- removed. This keeps the preflight decision and the destructive call
  -- consistent when two users act at the same time.
  IF cardinality(candidate_version_ids) > 0 THEN
    FOR version_row IN
      SELECT *
      FROM public.chemical_sds_versions
      WHERE id = ANY(candidate_version_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      NULL;
    END LOOP;

    FOR link_row IN
      SELECT *
      FROM public.chemical_department_chemical_links
      WHERE sds_version_id = ANY(candidate_version_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      NULL;
    END LOOP;

    FOR publication_row IN
      SELECT *
      FROM public.chemical_sds_publications
      WHERE sds_version_id = ANY(candidate_version_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      NULL;
    END LOOP;

  END IF;

  -- Delete only versions owned by this holding (or legacy versions with no
  -- owner) that have no remaining link/publication for another holding. A
  -- version used elsewhere stays in place. If this holding was its source,
  -- clear that source before deleting the holding so the other use remains
  -- valid.
  delete_version_ids := ARRAY(
    SELECT DISTINCT version.id
    FROM public.chemical_sds_versions AS version
    WHERE version.id = ANY(candidate_version_ids)
      AND (
        version.source_holding_id = p_holding_id
        OR version.source_holding_id IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.chemical_department_chemical_links AS link
        WHERE link.sds_version_id = version.id
          AND link.holding_id <> p_holding_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.chemical_sds_publications AS publication
        WHERE publication.sds_version_id = version.id
          AND publication.source_holding_id <> p_holding_id
      )
  );

  detach_version_ids := ARRAY(
      SELECT DISTINCT version.id
      FROM public.chemical_sds_versions AS version
      WHERE version.id = ANY(candidate_version_ids)
      AND version.source_holding_id = p_holding_id
      AND NOT (version.id = ANY(delete_version_ids))
  );

  -- Decide which physical files become orphaned before deleting their metadata.
  -- A file shared by another version or department SDS is deliberately kept.
  FOR department_sds_row IN
    SELECT *
    FROM public.chemical_department_sds
    WHERE id = ANY(target_department_sds_ids)
    ORDER BY id
    FOR UPDATE
  LOOP
    NULL;
  END LOOP;

  FOR file_row IN
    SELECT file.*
    FROM public.chemical_sds_files AS file
    WHERE file.id IN (
      SELECT version.file_id
      FROM public.chemical_sds_versions AS version
      WHERE version.id = ANY(delete_version_ids)
        AND version.file_id IS NOT NULL
      UNION
      SELECT department_sds.file_id
      FROM public.chemical_department_sds AS department_sds
      WHERE department_sds.id = ANY(target_department_sds_ids)
    )
    ORDER BY file.id
    FOR UPDATE
  LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM public.chemical_sds_versions AS version
      WHERE version.file_id = file_row.id
        AND version.id <> ALL(delete_version_ids)
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_sds AS department_sds
      WHERE department_sds.file_id = file_row.id
        AND department_sds.id <> ALL(target_department_sds_ids)
    ) THEN
      orphan_file_ids := array_append(orphan_file_ids, file_row.id);
      orphan_file_keys := array_append(orphan_file_keys, file_row.r2_key);
    END IF;
  END LOOP;

  -- FK-safe hard-delete order. Product master rows are never touched.
  DELETE FROM public.chemical_sds_publications
  WHERE id = ANY(target_publication_ids);

  DELETE FROM public.chemical_department_chemical_links
  WHERE id = ANY(target_link_ids);

  UPDATE public.chemical_sds_versions AS version
  SET source_holding_id = NULL,
    workflow_origin = 'legacy',
    updated_at = now()
  WHERE version.id = ANY(detach_version_ids)
    AND version.source_holding_id = p_holding_id;

  DELETE FROM public.chemical_sds_versions
  WHERE id = ANY(delete_version_ids);

  DELETE FROM public.chemical_department_sds AS department_sds
  WHERE department_sds.id = ANY(target_department_sds_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_chemical_links AS link
      WHERE link.department_sds_id = department_sds.id
    );

  DELETE FROM public.chemical_inventory_holdings
  WHERE id = p_holding_id;

  DELETE FROM public.chemical_sds_files AS file
  WHERE file.id = ANY(orphan_file_ids)
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_sds_versions AS version
      WHERE version.file_id = file.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_sds AS department_sds
      WHERE department_sds.file_id = file.id
    );

  RETURN jsonb_build_object(
    'ok', true,
    'holdingId', p_holding_id,
    'deletedPublicationIds', to_jsonb(target_publication_ids),
    'deletedDepartmentLinkIds', to_jsonb(target_link_ids),
    'deletedDepartmentSdsIds', to_jsonb(target_department_sds_ids),
    'deletedSdsVersionIds', to_jsonb(delete_version_ids),
    'detachedSdsVersionIds', to_jsonb(detach_version_ids),
    'deletedFileIds', to_jsonb(orphan_file_ids),
    'fileKeys', to_jsonb(orphan_file_keys)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_chemical_holding_cascade(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_chemical_holding_cascade(uuid, uuid)
  TO service_role;

-- Existing change requests remain callable for compatibility, but approved
-- holding_delete requests must use the same cascade delete behavior.
CREATE OR REPLACE FUNCTION public.review_chemical_holding_delete_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  target_before jsonb;
  request_after jsonb;
  delete_result jsonb;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;

  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.entity_type <> 'holding_delete' THEN
    RAISE EXCEPTION 'invalid_holding_delete_request';
  END IF;
  IF current_row.status <> 'in_review' THEN
    RAISE EXCEPTION 'change_request_not_in_review';
  END IF;
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

    SELECT public.delete_chemical_holding_cascade(current_row.entity_id, p_actor_id)
    INTO delete_result;
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
      'target_before', target_before, 'target_after', NULL,
      'delete_result', delete_result
    )::text
  );
  RETURN p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.review_chemical_holding_delete_request(uuid, uuid, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_holding_delete_request(uuid, uuid, text, text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
