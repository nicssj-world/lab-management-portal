BEGIN;

-- When an open round is loaded, carry forward each asset's latest dated
-- inspection into the round automatically. The immutable inspection remains
-- the evidence; only the round item status is reconciled.
CREATE OR REPLACE FUNCTION public.sync_lab_map_safety_inspection_round_existing_evidence(
  p_round_id uuid, p_actor_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  round_status text;
  round_started_by uuid;
  round_started_at timestamptz;
  item_record record;
  v_inspection_id uuid;
  linked_count integer := 0;
BEGIN
  SELECT round.status, round.started_by, round.started_at
    INTO round_status, round_started_by, round_started_at
  FROM public.lab_map_safety_inspection_rounds round
  WHERE round.id = p_round_id
  FOR UPDATE;

  IF NOT FOUND OR round_status <> 'open' OR round_started_by <> p_actor_id THEN
    RAISE EXCEPTION 'invalid_safety_inspection_round';
  END IF;

  FOR item_record IN
    SELECT item.id, item.asset_id
    FROM public.lab_map_safety_inspection_round_items item
    WHERE item.round_id = p_round_id
      AND item.status = 'pending'
    ORDER BY item.sequence_no
    FOR UPDATE
  LOOP
    v_inspection_id := NULL;
    SELECT latest.id
      INTO v_inspection_id
    FROM public.lab_map_safety_inspections latest
    WHERE latest.asset_id = item_record.asset_id
      AND latest.photo_r2_key IS NOT NULL
      AND latest.inspected_on >= (round_started_at AT TIME ZONE 'Asia/Bangkok')::date
      AND (latest.round_item_id IS NULL OR latest.round_item_id = item_record.id)
      AND NOT EXISTS (
        SELECT 1
        FROM public.lab_map_safety_inspections newer
        WHERE newer.asset_id = latest.asset_id
          AND (newer.inspected_on > latest.inspected_on
            OR (newer.inspected_on = latest.inspected_on AND newer.created_at > latest.created_at))
      )
    ORDER BY latest.inspected_on DESC, latest.created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF v_inspection_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.lab_map_safety_inspections
    SET round_item_id = item_record.id
    WHERE id = v_inspection_id
      AND (round_item_id IS NULL OR round_item_id = item_record.id);
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE public.lab_map_safety_inspection_round_items
    SET status = 'completed', inspection_id = v_inspection_id, completed_at = COALESCE(completed_at, now())
    WHERE id = item_record.id AND status = 'pending';
    IF FOUND THEN
      linked_count := linked_count + 1;
    END IF;
  END LOOP;

  RETURN linked_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_lab_map_safety_inspection_round_existing_evidence(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_lab_map_safety_inspection_round_existing_evidence(uuid, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
