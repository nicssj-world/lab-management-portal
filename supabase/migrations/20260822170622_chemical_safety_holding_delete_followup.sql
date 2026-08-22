-- Keep the registry hard-delete cascade aligned with the SDS department
-- publication state. The previous migration already exists in deployed
-- databases, so this follow-up replaces the function in place.
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
  department_row public.chemical_sds_departments%rowtype;
  file_row public.chemical_sds_files%rowtype;
  candidate_version_ids uuid[] := ARRAY[]::uuid[];
  delete_version_ids uuid[] := ARRAY[]::uuid[];
  detach_version_ids uuid[] := ARRAY[]::uuid[];
  target_link_ids uuid[] := ARRAY[]::uuid[];
  target_department_sds_ids uuid[] := ARRAY[]::uuid[];
  target_publication_ids uuid[] := ARRAY[]::uuid[];
  target_department_codes text[] := ARRAY[]::text[];
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
    IF publication_row.destination = 'department' AND publication_row.department_code IS NOT NULL THEN
      target_department_codes := array_append(target_department_codes, publication_row.department_code);
    END IF;
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

  -- Department SDS rows can be the only remaining content for a published
  -- department, so include their department codes in the same cleanup check.
  IF cardinality(target_department_sds_ids) > 0 THEN
    FOR department_sds_row IN
      SELECT *
      FROM public.chemical_department_sds
      WHERE id = ANY(target_department_sds_ids)
      ORDER BY id
      FOR UPDATE
    LOOP
      target_department_codes := array_append(target_department_codes, department_sds_row.department_code);
    END LOOP;
  END IF;
  target_department_codes := ARRAY(
    SELECT DISTINCT value
    FROM unnest(target_department_codes) AS array_item(value)
  );

  IF cardinality(target_department_codes) > 0 THEN
    FOR department_row IN
      SELECT *
      FROM public.chemical_sds_departments
      WHERE code = ANY(target_department_codes)
      ORDER BY code
      FOR UPDATE
    LOOP
      NULL;
    END LOOP;
  END IF;

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

  -- A department-level publication is the public state for the whole SDS
  -- department. Once the target was its last legacy/registry content, return
  -- that department to draft in the same transaction.
  UPDATE public.chemical_sds_departments AS department
  SET status = 'draft',
    published_by = NULL,
    published_at = NULL,
    updated_at = now()
  WHERE department.code = ANY(target_department_codes)
    AND department.status = 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_sds AS remaining_entry
      WHERE remaining_entry.department_code = department.code
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_sds_publications AS remaining_publication
      WHERE remaining_publication.department_code = department.code
        AND remaining_publication.destination = 'department'
        AND remaining_publication.status = 'active'
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

NOTIFY pgrst, 'reload schema';
COMMIT;
