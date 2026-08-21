-- Keep the live chemical/SDS workflow consistent with the current UI.
--
-- 1) Quantity units are validated by the API as free-form units (for example
--    test, kit, ชิ้น, ea). The old review RPCs still accepted only mL/L/g/kg.
-- 2) SDS versions remain one approved document per product. Every active
--    publication for that product must therefore move together when that
--    document is replaced, while publication rows remain scoped by unit and
--    destination.
-- 3) A new registry holding gets a draft SDS immediately, so the registry is
--    the single starting point for the SDS workflow.

BEGIN;

DO $migration$
DECLARE
  signature text;
  definition text;
  needle constant text := $needle$current_row.proposed_data->>'package_unit' NOT IN ('mL', 'L', 'g', 'kg')$needle$;
  replacement constant text := $replacement$
nullif(btrim(current_row.proposed_data->>'package_unit'), '') IS NULL
      OR current_row.proposed_data->>'package_unit' <> btrim(current_row.proposed_data->>'package_unit')
      OR char_length(btrim(current_row.proposed_data->>'package_unit')) > 20
      OR current_row.proposed_data->>'package_unit' ~ '[[:cntrl:]]'$replacement$;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.review_chemical_registry_entry_request(uuid,uuid,text,text)',
    'public.review_chemical_department_change_request(uuid,uuid,text,text)',
    'public.review_chemical_department_holding_change_request(uuid,uuid,text,text)'
  ] LOOP
    definition := pg_get_functiondef(signature::regprocedure);
    IF position(needle IN definition) > 0 THEN
      EXECUTE replace(definition, needle, replacement);
    ELSIF position('char_length(btrim(current_row.proposed_data->>''package_unit'')) > 20' IN definition) = 0 THEN
      RAISE EXCEPTION 'quantity unit guard not found in %', signature;
    END IF;
  END LOOP;
END;
$migration$;

-- There is one approved SDS version per product in the current schema. Keep
-- all active scoped publication rows pointed at that same approved version;
-- otherwise a room publication could retain a superseded version after a
-- department holding updates the product SDS.
CREATE OR REPLACE FUNCTION public.publish_chemical_sds(
  p_version_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_sds_versions%rowtype;
  target_unit_id uuid;
  target_destination text;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;

  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-product:' || current_row.product_id::text, 0
  ));

  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF current_row.file_id IS NULL THEN RAISE EXCEPTION 'sds_file_required'; END IF;

  IF current_row.source_holding_id IS NOT NULL THEN
    SELECT holding.unit_id, holding.storage_scope::text
    INTO target_unit_id, target_destination
    FROM public.chemical_inventory_holdings AS holding
    WHERE holding.id = current_row.source_holding_id;
  END IF;

  IF current_row.status <> 'approved' THEN
    UPDATE public.chemical_sds_versions
    SET status = 'superseded', updated_at = now()
    WHERE product_id = current_row.product_id
      AND status = 'approved'
      AND id <> p_version_id;

    UPDATE public.chemical_sds_versions
    SET status = 'approved', updated_at = now()
    WHERE id = p_version_id;
  END IF;

  UPDATE public.chemical_sds_publications
  SET sds_version_id = p_version_id
  WHERE product_id = current_row.product_id
    AND status = 'active'
    AND sds_version_id <> p_version_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.publish', p_actor_id, p_version_id::text,
    jsonb_build_object(
      'before', current_row.status, 'after', 'approved',
      'product_id', current_row.product_id,
      'unit_id', target_unit_id, 'destination', target_destination
    )::text
  );
  RETURN p_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_chemical_sds(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_chemical_sds(uuid,uuid)
  TO service_role;

DO $migration$
DECLARE
  definition text;
  marker constant text := '  UPDATE public.chemical_change_requests AS request';
  fragment constant text := $fragment$
  IF p_decision = 'approved' AND target_holding_id IS NOT NULL THEN
    INSERT INTO public.chemical_sds_versions (
      product_id, source_holding_id, workflow_origin, language, status, created_by
    )
    SELECT
      target_product_id, target_holding_id, 'registry_v2', 'th', 'draft', p_actor_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.chemical_sds_versions AS version
      WHERE version.source_holding_id = target_holding_id
        AND version.status IN ('draft', 'in_review', 'approved')
    );
  END IF;

$fragment$;
  marker_position integer;
BEGIN
  definition := pg_get_functiondef(
    'public.review_chemical_registry_entry_request(uuid,uuid,text,text)'::regprocedure
  );
  IF position('INSERT INTO public.chemical_sds_versions' IN definition) = 0 THEN
    marker_position := position(marker IN definition);
    IF marker_position = 0 THEN
      RAISE EXCEPTION 'registry review update marker not found';
    END IF;
    definition := replace(definition, marker, fragment || marker);
    EXECUTE definition;
  END IF;
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
