BEGIN;

CREATE TABLE IF NOT EXISTS public.lab_map_safety_inspection_expiry_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.lab_map_safety_assets(id) ON DELETE RESTRICT,
  inspection_id uuid NOT NULL REFERENCES public.lab_map_safety_inspections(id) ON DELETE RESTRICT,
  previous_expires_on date,
  expires_on date,
  corrected_by uuid NOT NULL REFERENCES public.profiles(id),
  corrected_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lab_map_safety_expiry_corrections_inspection
  ON public.lab_map_safety_inspection_expiry_corrections(inspection_id, corrected_at DESC, id DESC);

ALTER TABLE public.lab_map_safety_inspection_expiry_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lab_map_safety_inspection_expiry_corrections FROM anon, authenticated;
GRANT SELECT, INSERT ON public.lab_map_safety_inspection_expiry_corrections TO service_role;

CREATE OR REPLACE FUNCTION public.correct_lab_map_safety_inspection_expiry(
  p_asset_id uuid,
  p_inspection_id uuid,
  p_expires_on date,
  p_expected_updated_at timestamptz,
  p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  asset_updated_at timestamptz;
  latest_inspection_id uuid;
  previous_expires_on date;
  correction_id uuid;
BEGIN
  SELECT updated_at
    INTO asset_updated_at
  FROM public.lab_map_safety_assets
  WHERE id = p_asset_id AND lifecycle_status = 'active'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'safety_asset_not_active';
  END IF;

  IF p_expected_updated_at IS NOT NULL AND asset_updated_at <> p_expected_updated_at THEN
    RAISE EXCEPTION 'stale_safety_asset';
  END IF;

  SELECT inspection.id
    INTO latest_inspection_id
  FROM public.lab_map_safety_inspections inspection
  WHERE inspection.asset_id = p_asset_id
    AND inspection.superseded_at IS NULL
  ORDER BY inspection.inspected_on DESC, inspection.created_at DESC, inspection.id DESC
  LIMIT 1;
  IF NOT FOUND OR latest_inspection_id <> p_inspection_id THEN
    RAISE EXCEPTION 'inspection_not_latest';
  END IF;

  SELECT correction.expires_on
    INTO previous_expires_on
  FROM public.lab_map_safety_inspection_expiry_corrections correction
  WHERE correction.inspection_id = p_inspection_id
  ORDER BY correction.corrected_at DESC, correction.id DESC
  LIMIT 1;
  IF NOT FOUND THEN
    SELECT inspection.expires_on
      INTO previous_expires_on
    FROM public.lab_map_safety_inspections inspection
    WHERE inspection.id = p_inspection_id;
  END IF;

  IF previous_expires_on IS NOT DISTINCT FROM p_expires_on THEN
    RAISE EXCEPTION 'expiry_unchanged';
  END IF;

  INSERT INTO public.lab_map_safety_inspection_expiry_corrections (
    asset_id, inspection_id, previous_expires_on, expires_on, corrected_by
  ) VALUES (
    p_asset_id, p_inspection_id, previous_expires_on, p_expires_on, p_actor_id
  ) RETURNING id INTO correction_id;

  UPDATE public.lab_map_safety_assets
  SET updated_at = now()
  WHERE id = p_asset_id;

  RETURN correction_id;
END;
$$;

REVOKE ALL ON FUNCTION public.correct_lab_map_safety_inspection_expiry(uuid, uuid, date, timestamptz, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_lab_map_safety_inspection_expiry(uuid, uuid, date, timestamptz, uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
