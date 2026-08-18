BEGIN;

-- A field inspection may have been recorded just before (or while) an open
-- round was being worked. Link that immutable inspection to the round item
-- instead of uploading the same evidence a second time.
CREATE OR REPLACE FUNCTION public.link_lab_map_safety_inspection_to_round(
  p_asset_id uuid, p_inspection_id uuid, p_round_item_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  inspection_asset_id uuid;
  inspection_round_item_id uuid;
  inspection_on date;
  item_asset_id uuid;
  item_status text;
  item_inspection_id uuid;
  round_status text;
  round_started_by uuid;
  round_started_at timestamptz;
BEGIN
  SELECT inspection.asset_id, inspection.round_item_id, inspection.inspected_on
    INTO inspection_asset_id, inspection_round_item_id, inspection_on
  FROM public.lab_map_safety_inspections inspection
  WHERE inspection.id = p_inspection_id
  FOR UPDATE;
  IF NOT FOUND OR inspection_asset_id <> p_asset_id THEN
    RAISE EXCEPTION 'invalid_safety_inspection';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.lab_map_safety_inspections candidate
    WHERE candidate.id = p_inspection_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.lab_map_safety_inspections newer
        WHERE newer.asset_id = p_asset_id
          AND (newer.inspected_on > candidate.inspected_on
            OR (newer.inspected_on = candidate.inspected_on AND newer.created_at > candidate.created_at))
      )
  ) THEN
    RAISE EXCEPTION 'inspection_not_latest';
  END IF;

  SELECT item.asset_id, item.status, item.inspection_id,
         round.status, round.started_by, round.started_at
    INTO item_asset_id, item_status, item_inspection_id,
         round_status, round_started_by, round_started_at
  FROM public.lab_map_safety_inspection_round_items item
  JOIN public.lab_map_safety_inspection_rounds round ON round.id = item.round_id
  WHERE item.id = p_round_item_id
  FOR UPDATE OF item, round;
  IF NOT FOUND OR item_asset_id <> p_asset_id
     OR round_status <> 'open' OR round_started_by <> p_actor_id THEN
    RAISE EXCEPTION 'invalid_safety_inspection_round_item';
  END IF;
  IF item_status = 'completed' AND item_inspection_id = p_inspection_id THEN
    RETURN p_inspection_id;
  END IF;
  IF item_status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_safety_inspection_round_item';
  END IF;
  IF inspection_round_item_id IS NOT NULL AND inspection_round_item_id <> p_round_item_id THEN
    RAISE EXCEPTION 'inspection_already_linked';
  END IF;
  IF inspection_on < (round_started_at AT TIME ZONE 'Asia/Bangkok')::date THEN
    RAISE EXCEPTION 'inspection_predates_round';
  END IF;

  UPDATE public.lab_map_safety_inspections
  SET round_item_id = p_round_item_id
  WHERE id = p_inspection_id;
  UPDATE public.lab_map_safety_inspection_round_items
  SET status = 'completed', inspection_id = p_inspection_id, completed_at = now()
  WHERE id = p_round_item_id;
  RETURN p_inspection_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_lab_map_safety_inspection_to_round(uuid, uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_lab_map_safety_inspection_to_round(uuid, uuid, uuid, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
