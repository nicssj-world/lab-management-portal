BEGIN;

ALTER TABLE public.lab_map_safety_inspections
  ADD COLUMN IF NOT EXISTS superseded_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'lab_map_safety_inspections_superseded_by_fkey'
  ) THEN
    ALTER TABLE public.lab_map_safety_inspections
      ADD CONSTRAINT lab_map_safety_inspections_superseded_by_fkey
      FOREIGN KEY (superseded_by)
      REFERENCES public.lab_map_safety_inspections(id)
      ON DELETE SET NULL;
  END IF;
END;
$$;

-- Keep the newest round-linked record when possible, otherwise keep the newest
-- submission. Older rows remain available for audit but are not operational evidence.
WITH ranked AS (
  SELECT
    id,
    first_value(id) OVER (
      PARTITION BY asset_id, inspected_on
      ORDER BY (round_item_id IS NOT NULL) DESC, created_at DESC, id DESC
    ) AS winner,
    row_number() OVER (
      PARTITION BY asset_id, inspected_on
      ORDER BY (round_item_id IS NOT NULL) DESC, created_at DESC, id DESC
    ) AS row_number
  FROM public.lab_map_safety_inspections
  WHERE photo_r2_key IS NOT NULL AND superseded_at IS NULL
)
UPDATE public.lab_map_safety_inspections duplicate
SET superseded_at = now(), superseded_by = ranked.winner
FROM ranked
WHERE duplicate.id = ranked.id
  AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS lab_map_safety_inspections_asset_date_photo_unique
  ON public.lab_map_safety_inspections(asset_id, inspected_on)
  WHERE photo_r2_key IS NOT NULL AND superseded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_inspections_active_asset
  ON public.lab_map_safety_inspections(asset_id, inspected_on DESC, created_at DESC)
  WHERE superseded_at IS NULL;

DROP FUNCTION IF EXISTS public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid,uuid,jsonb
);

CREATE OR REPLACE FUNCTION public.record_lab_map_safety_inspection(
  p_asset_id uuid, p_result text, p_inspected_on date, p_next_inspection_date date,
  p_expires_on date, p_note text, p_photo_r2_key text, p_photo_file_name text,
  p_photo_content_type text, p_photo_size_bytes bigint, p_actor_id uuid,
  p_round_item_id uuid, p_checklist_snapshot jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  new_id uuid;
  existing_id uuid;
  existing_round_item_id uuid;
  item_asset_id uuid;
  item_status text;
  item_inspection_id uuid;
  round_status text;
BEGIN
  IF p_result NOT IN ('passed', 'needs_attention', 'failed', 'not_found') THEN
    RAISE EXCEPTION 'invalid_inspection_result';
  END IF;

  -- Lock the asset first. This serializes two submissions for the same asset
  -- even when they arrive at the same time from two browser tabs.
  IF NOT EXISTS (
    SELECT 1
    FROM public.lab_map_safety_assets
    WHERE id = p_asset_id AND lifecycle_status = 'active'
    FOR UPDATE
  ) THEN
    RAISE EXCEPTION 'safety_asset_not_active';
  END IF;

  IF p_round_item_id IS NOT NULL THEN
    SELECT item.asset_id, item.status, item.inspection_id, round.status
      INTO item_asset_id, item_status, item_inspection_id, round_status
    FROM public.lab_map_safety_inspection_round_items item
    JOIN public.lab_map_safety_inspection_rounds round ON round.id = item.round_id
    WHERE item.id = p_round_item_id
    FOR UPDATE OF item, round;

    IF NOT FOUND OR item_asset_id <> p_asset_id OR round_status <> 'open' THEN
      RAISE EXCEPTION 'invalid_safety_inspection_round_item';
    END IF;

    -- A retry after the round item was completed is idempotent: reuse the
    -- existing inspection instead of creating another photo row.
    IF item_status = 'completed' AND item_inspection_id IS NOT NULL THEN
      RETURN item_inspection_id;
    END IF;
    IF item_status <> 'pending' THEN
      RAISE EXCEPTION 'invalid_safety_inspection_round_item';
    END IF;
  END IF;

  -- A photo inspection is one operational result per asset/date. Reusing the
  -- existing id lets the API remove the newly uploaded duplicate object.
  SELECT inspection.id, inspection.round_item_id
    INTO existing_id, existing_round_item_id
  FROM public.lab_map_safety_inspections inspection
  WHERE inspection.asset_id = p_asset_id
    AND inspection.inspected_on = p_inspected_on
    AND inspection.photo_r2_key IS NOT NULL
    AND inspection.superseded_at IS NULL
  ORDER BY
    (p_round_item_id IS NOT NULL AND inspection.round_item_id = p_round_item_id) DESC,
    (inspection.round_item_id IS NULL) DESC,
    inspection.created_at DESC,
    inspection.id DESC
  LIMIT 1
  FOR UPDATE;

  IF existing_id IS NOT NULL THEN
    IF p_round_item_id IS NOT NULL AND existing_round_item_id IS NOT NULL
       AND existing_round_item_id <> p_round_item_id THEN
      RAISE EXCEPTION 'inspection_already_recorded_for_date';
    END IF;

    IF p_round_item_id IS NOT NULL AND existing_round_item_id IS NULL THEN
      UPDATE public.lab_map_safety_inspections
      SET round_item_id = p_round_item_id
      WHERE id = existing_id;
      UPDATE public.lab_map_safety_inspection_round_items
      SET status = 'completed', inspection_id = existing_id, completed_at = COALESCE(completed_at, now())
      WHERE id = p_round_item_id AND status = 'pending';
    END IF;
    RETURN existing_id;
  END IF;

  INSERT INTO public.lab_map_safety_inspections (
    asset_id, result, inspected_on, next_inspection_date, expires_on, note,
    photo_r2_key, photo_file_name, photo_content_type, photo_size_bytes, inspected_by,
    round_item_id, checklist_snapshot
  ) VALUES (
    p_asset_id, p_result, p_inspected_on, p_next_inspection_date, p_expires_on, p_note,
    p_photo_r2_key, p_photo_file_name, p_photo_content_type, p_photo_size_bytes, p_actor_id,
    p_round_item_id, COALESCE(p_checklist_snapshot, '[]'::jsonb)
  ) RETURNING id INTO new_id;

  IF p_round_item_id IS NOT NULL THEN
    UPDATE public.lab_map_safety_inspection_round_items
    SET status = 'completed', inspection_id = new_id, completed_at = now()
    WHERE id = p_round_item_id;
  END IF;

  UPDATE public.lab_map_safety_assets SET
    position_status = CASE WHEN p_result = 'not_found' THEN 'unverified' ELSE 'verified' END,
    position_verified_by = CASE WHEN p_result = 'not_found' THEN NULL ELSE p_actor_id END,
    position_verified_at = CASE WHEN p_result = 'not_found' THEN NULL ELSE now() END,
    updated_at = now()
  WHERE id = p_asset_id;
  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid,uuid,jsonb
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid,uuid,jsonb
) TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
