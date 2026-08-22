-- Make one SDS file the only department-level SDS for each registry holding.
--
-- The SDS-only promotion migration temporarily allowed more than one legacy
-- department link per holding. Registry-first is now the source of truth, so
-- active registry publications win; otherwise the best legacy link wins by
-- status, update time, link time, and a stable id tie-breaker.
--
-- Keep the cleanup inside one DO block. Supabase SQL Editor may execute
-- top-level statements in separate sessions; temporary tables created by one
-- statement would then be unavailable to the next statement.
--
-- This removes only duplicate relationships/metadata and unreferenced SDS
-- versions/files. A physical file referenced by another SDS version or
-- department entry is retained.

DO $$
BEGIN
  ALTER TABLE public.chemical_department_chemical_links
    DROP CONSTRAINT IF EXISTS chemical_department_chemical_links_holding_id_key;

  CREATE TEMP TABLE chemical_department_sds_dedup_keep (
    holding_id uuid PRIMARY KEY,
    link_id uuid,
    department_sds_id uuid,
    sds_version_id uuid,
    source text NOT NULL CHECK (source IN ('legacy', 'registry'))
  ) ON COMMIT DROP;

  INSERT INTO chemical_department_sds_dedup_keep (
    holding_id, link_id, department_sds_id, sds_version_id, source
  )
  WITH active_publications AS (
    SELECT DISTINCT ON (publication.source_holding_id)
      publication.source_holding_id AS holding_id,
      publication.sds_version_id
    FROM public.chemical_sds_publications AS publication
    WHERE publication.destination = 'department'
      AND publication.status = 'active'
    ORDER BY publication.source_holding_id, publication.linked_at DESC, publication.id DESC
  ), ranked_legacy_links AS (
    SELECT
      link.holding_id,
      link.id AS link_id,
      link.department_sds_id,
      link.sds_version_id,
      row_number() OVER (
        PARTITION BY link.holding_id
        ORDER BY
          CASE version.status
            WHEN 'approved' THEN 4
            WHEN 'in_review' THEN 3
            WHEN 'draft' THEN 2
            WHEN 'rejected' THEN 1
            WHEN 'superseded' THEN 0
            ELSE -1
          END DESC,
          version.updated_at DESC NULLS LAST,
          link.linked_at DESC NULLS LAST,
          link.id DESC
      ) AS row_number
    FROM public.chemical_department_chemical_links AS link
    LEFT JOIN public.chemical_sds_versions AS version
      ON version.id = link.sds_version_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM active_publications AS publication
      WHERE publication.holding_id = link.holding_id
    )
  )
  SELECT holding_id, NULL::uuid, NULL::uuid, sds_version_id, 'registry'
  FROM active_publications
  UNION ALL
  SELECT holding_id, link_id, department_sds_id, sds_version_id, 'legacy'
  FROM ranked_legacy_links
  WHERE row_number = 1;

  CREATE TEMP TABLE chemical_department_sds_dedup_delete_links ON COMMIT DROP AS
  SELECT link.id, link.department_sds_id, link.sds_version_id
  FROM public.chemical_department_chemical_links AS link
  WHERE NOT EXISTS (
    SELECT 1
    FROM chemical_department_sds_dedup_keep AS keeper
    WHERE keeper.link_id = link.id
  );

  CREATE TEMP TABLE chemical_department_sds_dedup_delete_entries ON COMMIT DROP AS
  SELECT DISTINCT entry.id, entry.file_id
  FROM public.chemical_department_sds AS entry
  JOIN chemical_department_sds_dedup_delete_links AS deleted_link
    ON deleted_link.department_sds_id = entry.id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.chemical_department_chemical_links AS remaining_link
    WHERE remaining_link.department_sds_id = entry.id
      AND NOT EXISTS (
        SELECT 1
        FROM chemical_department_sds_dedup_delete_links AS deleted_remaining_link
        WHERE deleted_remaining_link.id = remaining_link.id
      )
  );

  CREATE TEMP TABLE chemical_department_sds_dedup_delete_versions ON COMMIT DROP AS
  SELECT DISTINCT version.id, version.file_id
  FROM public.chemical_sds_versions AS version
  JOIN chemical_department_sds_dedup_delete_links AS deleted_link
    ON deleted_link.sds_version_id = version.id
  WHERE version.source_holding_id IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_department_chemical_links AS remaining_link
      WHERE remaining_link.sds_version_id = version.id
        AND NOT EXISTS (
          SELECT 1
          FROM chemical_department_sds_dedup_delete_links AS deleted_remaining_link
          WHERE deleted_remaining_link.id = remaining_link.id
        )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.chemical_sds_publications AS publication
      WHERE publication.sds_version_id = version.id
    );

  DELETE FROM public.chemical_department_chemical_links AS link
  USING chemical_department_sds_dedup_delete_links AS deleted_link
  WHERE link.id = deleted_link.id;

  DELETE FROM public.chemical_sds_versions AS version
  USING chemical_department_sds_dedup_delete_versions AS deleted_version
  WHERE version.id = deleted_version.id;

  DELETE FROM public.chemical_department_sds AS entry
  USING chemical_department_sds_dedup_delete_entries AS deleted_entry
  WHERE entry.id = deleted_entry.id;

  DELETE FROM public.chemical_sds_files AS file
  WHERE file.id IN (
    SELECT file_id
    FROM chemical_department_sds_dedup_delete_entries
    WHERE file_id IS NOT NULL
    UNION
    SELECT file_id
    FROM chemical_department_sds_dedup_delete_versions
    WHERE file_id IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.chemical_sds_versions AS remaining_version
    WHERE remaining_version.file_id = file.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.chemical_department_sds AS remaining_entry
    WHERE remaining_entry.file_id = file.id
  );

  CREATE UNIQUE INDEX IF NOT EXISTS uq_chemical_department_chemical_links_holding_id
    ON public.chemical_department_chemical_links(holding_id);

  PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;
