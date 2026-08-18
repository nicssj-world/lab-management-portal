BEGIN;

-- A scheduled task owns the inspection period. Reuse the latest active photo
-- from that period even when the user opens the map round later, so an
-- inspection taken yesterday is not uploaded again today. The inspection is
-- immutable; only its current round association is moved to the canonical
-- task round.
CREATE OR REPLACE FUNCTION public.sync_lab_map_safety_inspection_round_existing_evidence(
  p_round_id uuid, p_actor_id uuid
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  round_status text;
  round_started_at timestamptz;
  round_filter_snapshot jsonb;
  evidence_from date;
  item_record record;
  v_inspection_id uuid;
  linked_count integer := 0;
BEGIN
  SELECT round.status, round.started_at, round.filter_snapshot
    INTO round_status, round_started_at, round_filter_snapshot
  FROM public.lab_map_safety_inspection_rounds round
  WHERE round.id = p_round_id
  FOR UPDATE;

  IF NOT FOUND OR round_status <> 'open' THEN
    RAISE EXCEPTION 'invalid_safety_inspection_round';
  END IF;

  evidence_from := COALESCE(
    NULLIF(round_filter_snapshot->>'periodStart', '')::date,
    (round_started_at AT TIME ZONE 'Asia/Bangkok')::date
  );

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
      AND latest.superseded_at IS NULL
      AND latest.inspected_on >= evidence_from
      AND NOT EXISTS (
        SELECT 1
        FROM public.lab_map_safety_inspections newer
        WHERE newer.asset_id = latest.asset_id
          AND newer.superseded_at IS NULL
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
    WHERE id = v_inspection_id;

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
