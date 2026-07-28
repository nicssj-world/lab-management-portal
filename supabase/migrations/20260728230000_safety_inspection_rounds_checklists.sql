BEGIN;

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspection_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  filter_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_by uuid NOT NULL REFERENCES public.profiles(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  closed_by uuid REFERENCES public.profiles(id),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspection_round_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.lab_map_safety_inspection_rounds(id) ON DELETE RESTRICT,
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  sequence_no integer NOT NULL CHECK (sequence_no > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  inspection_id uuid REFERENCES public.lab_map_safety_inspections(id) ON DELETE RESTRICT,
  completed_at timestamptz,
  UNIQUE (round_id, asset_id),
  UNIQUE (round_id, sequence_no)
);

ALTER TABLE public.lab_map_safety_inspections
  ADD COLUMN IF NOT EXISTS round_item_id uuid REFERENCES public.lab_map_safety_inspection_round_items(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS checklist_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_rounds_status
  ON public.lab_map_safety_inspection_rounds(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_round_items_sequence
  ON public.lab_map_safety_inspection_round_items(round_id, sequence_no);
CREATE INDEX IF NOT EXISTS idx_lab_map_safety_inspections_round_item
  ON public.lab_map_safety_inspections(round_item_id);

ALTER TABLE public.lab_map_safety_inspection_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_map_safety_inspection_round_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_map_safety_inspection_rounds,
  public.lab_map_safety_inspection_round_items FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_map_safety_inspection_rounds,
  public.lab_map_safety_inspection_round_items TO service_role;

DROP FUNCTION IF EXISTS public.record_lab_map_safety_inspection(
  uuid,text,date,date,date,text,text,text,text,bigint,uuid
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
  item_asset_id uuid;
  item_status text;
  round_status text;
BEGIN
  IF p_result NOT IN ('passed', 'needs_attention', 'failed', 'not_found') THEN
    RAISE EXCEPTION 'invalid_inspection_result';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.lab_map_safety_assets
    WHERE id = p_asset_id AND lifecycle_status = 'active' FOR UPDATE
  ) THEN RAISE EXCEPTION 'safety_asset_not_active'; END IF;
  IF p_round_item_id IS NOT NULL THEN
    SELECT item.asset_id, item.status, round.status
      INTO item_asset_id, item_status, round_status
    FROM public.lab_map_safety_inspection_round_items item
    JOIN public.lab_map_safety_inspection_rounds round ON round.id = item.round_id
    WHERE item.id = p_round_item_id
    FOR UPDATE OF item, round;
    IF NOT FOUND OR item_asset_id <> p_asset_id OR item_status <> 'pending' OR round_status <> 'open' THEN
      RAISE EXCEPTION 'invalid_safety_inspection_round_item';
    END IF;
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
