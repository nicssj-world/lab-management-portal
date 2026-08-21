-- Promote every remaining department SDS file into the current registry.
--
-- SDS-only is a real inventory-capture state. It means that the chemical
-- identity and SDS are usable now, while quantity, package unit and stock
-- counts are intentionally still unknown. No zeroes or guessed units are
-- written for this state.

BEGIN;

ALTER TABLE public.chemical_inventory_holdings
  ADD COLUMN IF NOT EXISTS inventory_capture_status text NOT NULL DEFAULT 'complete';

ALTER TABLE public.chemical_inventory_holdings
  ALTER COLUMN package_value DROP NOT NULL,
  ALTER COLUMN package_unit DROP NOT NULL,
  ALTER COLUMN current_container_count DROP NOT NULL,
  ALTER COLUMN minimum_stock DROP NOT NULL;

ALTER TABLE public.chemical_inventory_holdings
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_inventory_capture_status_check,
  DROP CONSTRAINT IF EXISTS chemical_inventory_holdings_inventory_capture_quantity_check;

ALTER TABLE public.chemical_inventory_holdings
  ADD CONSTRAINT chemical_inventory_holdings_inventory_capture_status_check
    CHECK (inventory_capture_status IN ('complete', 'sds_only')),
  ADD CONSTRAINT chemical_inventory_holdings_inventory_capture_quantity_check
    CHECK (
      inventory_capture_status = 'sds_only'
      OR (
        package_value IS NOT NULL
        AND package_unit IS NOT NULL
        AND current_container_count IS NOT NULL
        AND minimum_stock IS NOT NULL
      )
    );

CREATE OR REPLACE FUNCTION public.normalize_chemical_inventory_capture_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.package_value IS NOT NULL
    AND NEW.package_unit IS NOT NULL
    AND NEW.current_container_count IS NOT NULL
    AND NEW.minimum_stock IS NOT NULL
  THEN
    NEW.inventory_capture_status := 'complete';
  ELSE
    NEW.inventory_capture_status := 'sds_only';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chemical_inventory_capture_status_guard
  ON public.chemical_inventory_holdings;
CREATE TRIGGER chemical_inventory_capture_status_guard
  BEFORE INSERT OR UPDATE OF package_value, package_unit,
    current_container_count, minimum_stock, inventory_capture_status
  ON public.chemical_inventory_holdings
  FOR EACH ROW EXECUTE FUNCTION public.normalize_chemical_inventory_capture_status();

REVOKE ALL ON FUNCTION public.normalize_chemical_inventory_capture_status()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_chemical_inventory_capture_status()
  TO service_role;

-- A holding can have more than one department SDS document (for example,
-- duplicate copies or different revisions). The department SDS row remains
-- unique; only the old one-file-per-holding limitation is removed.
ALTER TABLE public.chemical_department_chemical_links
  DROP CONSTRAINT IF EXISTS chemical_department_chemical_links_holding_id_key;

CREATE OR REPLACE FUNCTION public.register_department_sds_as_sds_only(
  p_department_sds_id uuid,
  p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  source_row record;
  source_file_id uuid;
  source_unit_id uuid;
  source_display_name text;
  existing_link_id uuid;
  product_candidates uuid[];
  product_candidate_count integer := 0;
  v_product_id uuid;
  v_holding_id uuid;
  v_sds_version_id uuid;
  v_link_id uuid;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;

  SELECT
    entry.file_id,
    entry.department_code,
    entry.display_name,
    unit.id AS unit_id
  INTO source_row
  FROM public.chemical_department_sds AS entry
  JOIN public.chemical_sds_departments AS department
    ON department.code = entry.department_code
  LEFT JOIN public.chemical_units AS unit
    ON unit.name_th = department.department
   AND unit.active = true
  WHERE entry.id = p_department_sds_id
  FOR UPDATE OF entry;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_sds_not_found';
  END IF;
  IF source_row.file_id IS NULL THEN
    RAISE EXCEPTION 'department_sds_file_not_found';
  END IF;
  IF source_row.unit_id IS NULL THEN
    RAISE EXCEPTION 'department_sds_unit_not_found';
  END IF;

  SELECT link.id
  INTO existing_link_id
  FROM public.chemical_department_chemical_links AS link
  WHERE link.department_sds_id = p_department_sds_id
  FOR UPDATE;
  IF existing_link_id IS NOT NULL THEN
    RETURN existing_link_id;
  END IF;

  source_file_id := source_row.file_id;
  source_unit_id := source_row.unit_id;
  source_display_name := NULLIF(btrim(source_row.display_name), '');
  IF source_display_name IS NULL THEN
    RAISE EXCEPTION 'department_sds_display_name_required';
  END IF;

  -- Serialize promotion of the same name/unit so a repeated SDS file cannot
  -- create two provisional products during concurrent requests.
  PERFORM pg_advisory_xact_lock(hashtextextended(
    'chemical-sds-only:' || source_unit_id::text || ':' || lower(source_display_name),
    0
  ));

  -- Reuse a provisional SDS-only product already created for this unit/name.
  -- This is what keeps duplicate department copies on one registry holding.
  SELECT holding.product_id
  INTO v_product_id
  FROM public.chemical_inventory_holdings AS holding
  JOIN public.chemical_products AS product
    ON product.id = holding.product_id
  WHERE holding.unit_id = source_unit_id
    AND holding.storage_scope = 'department'
    AND holding.inventory_capture_status = 'sds_only'
    AND product.lifecycle_status = 'active'
    AND lower(btrim(product.canonical_name)) = lower(source_display_name)
  ORDER BY holding.updated_at, holding.id
  LIMIT 1
  FOR UPDATE OF holding;

  -- An exact canonical name or alias is safe to reuse as the product master,
  -- but an ambiguous exact match is intentionally kept separate. This avoids
  -- silently assigning a department SDS to the wrong product variant.
  IF v_product_id IS NULL THEN
    SELECT array_agg(DISTINCT product.id ORDER BY product.id)
    INTO product_candidates
    FROM public.chemical_products AS product
    WHERE product.lifecycle_status = 'active'
      AND (
        lower(btrim(product.canonical_name)) = lower(source_display_name)
        OR EXISTS (
          SELECT 1
          FROM public.chemical_product_aliases AS alias
          WHERE alias.product_id = product.id
            AND lower(btrim(alias.alias)) = lower(source_display_name)
        )
      );

    product_candidate_count := COALESCE(array_length(product_candidates, 1), 0);
    IF product_candidate_count = 1 THEN
      v_product_id := product_candidates[1];
    ELSE
      INSERT INTO public.chemical_products (
        canonical_name,
        lifecycle_status,
        created_by
      ) VALUES (
        source_display_name,
        'active',
        p_actor_id
      )
      RETURNING id INTO v_product_id;
    END IF;
  END IF;

  INSERT INTO public.chemical_unit_products (
    product_id,
    unit_id,
    preferred_name,
    active,
    public_eligible
  ) VALUES (
    v_product_id,
    source_unit_id,
    source_display_name,
    true,
    EXISTS (
      SELECT 1
      FROM public.chemical_inventory_holdings AS room_holding
      WHERE room_holding.product_id = v_product_id
        AND room_holding.unit_id = source_unit_id
        AND room_holding.storage_scope = 'room'
    )
  )
  ON CONFLICT (product_id, unit_id) DO UPDATE SET
    active = true,
    preferred_name = COALESCE(
      public.chemical_unit_products.preferred_name,
      EXCLUDED.preferred_name
    ),
    public_eligible = CASE
      WHEN EXISTS (
        SELECT 1
        FROM public.chemical_inventory_holdings AS room_holding
        WHERE room_holding.product_id = v_product_id
          AND room_holding.unit_id = source_unit_id
          AND room_holding.storage_scope = 'room'
      ) THEN true
      ELSE public.chemical_unit_products.public_eligible
    END;

  SELECT holding.id
  INTO v_holding_id
  FROM public.chemical_inventory_holdings AS holding
  WHERE holding.product_id = v_product_id
    AND holding.unit_id = source_unit_id
    AND holding.storage_scope = 'department'
    AND holding.inventory_capture_status = 'sds_only'
  ORDER BY holding.updated_at, holding.id
  LIMIT 1
  FOR UPDATE;

  IF v_holding_id IS NULL THEN
    INSERT INTO public.chemical_inventory_holdings (
      product_id,
      unit_id,
      storage_scope,
      location_id,
      lot_number,
      package_value,
      package_unit,
      current_container_count,
      minimum_stock,
      reported_total_raw,
      calculated_total_value,
      calculated_total_unit,
      received_on,
      opened_on,
      expires_on,
      effective_on,
      workflow_origin,
      inventory_capture_status
    ) VALUES (
      v_product_id,
      source_unit_id,
      'department',
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      NULL,
      'current',
      'sds_only'
    )
    RETURNING id INTO v_holding_id;
  END IF;

  SELECT version.id
  INTO v_sds_version_id
  FROM public.chemical_sds_versions AS version
  WHERE version.product_id = v_product_id
    AND version.file_id = source_file_id
  ORDER BY version.created_at DESC, version.id DESC
  LIMIT 1
  FOR UPDATE;

  IF v_sds_version_id IS NULL THEN
    INSERT INTO public.chemical_sds_versions (
      product_id,
      file_id,
      language,
      status,
      created_by,
      workflow_origin
    ) VALUES (
      v_product_id,
      source_file_id,
      'th',
      'draft',
      p_actor_id,
      'current'
    )
    RETURNING id INTO v_sds_version_id;
  END IF;

  INSERT INTO public.chemical_department_chemical_links (
    department_sds_id,
    product_id,
    holding_id,
    sds_version_id,
    linked_by
  ) VALUES (
    p_department_sds_id,
    v_product_id,
    v_holding_id,
    v_sds_version_id,
    p_actor_id
  )
  RETURNING id INTO v_link_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.department_sds.register_sds_only',
    p_actor_id,
    p_department_sds_id::text,
    jsonb_build_object(
      'department_sds_id', p_department_sds_id,
      'product_id', v_product_id,
      'holding_id', v_holding_id,
      'sds_version_id', v_sds_version_id,
      'inventory_capture_status', 'sds_only',
      'label', 'SDS-only — ยังไม่ระบุปริมาณ',
      'quantity_intentionally_unknown', true
    )::text
  );

  RETURN v_link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.register_department_sds_as_sds_only(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_department_sds_as_sds_only(uuid, uuid)
  TO service_role;

-- The holding remains a valid target for another SDS file. The SDS file itself
-- is still protected by its unique department_sds_id constraint.
CREATE OR REPLACE FUNCTION public.link_department_sds_to_existing_holding(
  p_department_sds_id uuid,
  p_holding_id uuid,
  p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  source_file_id uuid;
  source_department_code text;
  source_unit_id uuid;
  holding_product_id uuid;
  holding_unit_id uuid;
  holding_storage_scope text;
  holding_unit_product_active boolean;
  holding_product_status text;
  sds_version_id uuid;
  link_id uuid;
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'actor_required';
  END IF;

  SELECT entry.file_id, entry.department_code
  INTO source_file_id, source_department_code
  FROM public.chemical_department_sds AS entry
  WHERE entry.id = p_department_sds_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_sds_not_found';
  END IF;
  IF source_file_id IS NULL THEN
    RAISE EXCEPTION 'department_sds_file_not_found';
  END IF;

  SELECT unit.id
  INTO source_unit_id
  FROM public.chemical_sds_departments AS department
  JOIN public.chemical_units AS unit
    ON unit.name_th = department.department
   AND unit.active = true
  WHERE department.code = source_department_code;

  IF source_unit_id IS NULL THEN
    RAISE EXCEPTION 'department_sds_unit_not_found';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chemical_department_chemical_links AS link
    WHERE link.department_sds_id = p_department_sds_id
  ) THEN
    RAISE EXCEPTION 'department_sds_already_linked';
  END IF;

  SELECT
    holding.product_id,
    holding.unit_id,
    holding.storage_scope::text,
    unit_product.active,
    product.lifecycle_status::text
  INTO
    holding_product_id,
    holding_unit_id,
    holding_storage_scope,
    holding_unit_product_active,
    holding_product_status
  FROM public.chemical_inventory_holdings AS holding
  JOIN public.chemical_products AS product
    ON product.id = holding.product_id
  LEFT JOIN public.chemical_unit_products AS unit_product
    ON unit_product.product_id = holding.product_id
   AND unit_product.unit_id = holding.unit_id
  WHERE holding.id = p_holding_id
  FOR UPDATE OF holding;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'department_holding_not_found';
  END IF;
  IF holding_storage_scope <> 'department' THEN
    RAISE EXCEPTION 'department_holding_wrong_scope';
  END IF;
  IF holding_unit_id <> source_unit_id THEN
    RAISE EXCEPTION 'department_holding_wrong_unit';
  END IF;
  IF holding_unit_product_active IS DISTINCT FROM true
    OR holding_product_status <> 'active'
  THEN
    RAISE EXCEPTION 'department_holding_inactive';
  END IF;

  SELECT version.id
  INTO sds_version_id
  FROM public.chemical_sds_versions AS version
  WHERE version.product_id = holding_product_id
    AND version.file_id = source_file_id
  ORDER BY version.created_at DESC, version.id DESC
  LIMIT 1;

  IF sds_version_id IS NULL THEN
    INSERT INTO public.chemical_sds_versions (
      product_id,
      file_id,
      language,
      status,
      created_by,
      workflow_origin
    ) VALUES (
      holding_product_id,
      source_file_id,
      'th',
      'draft',
      p_actor_id,
      'current'
    )
    RETURNING id INTO sds_version_id;
  END IF;

  INSERT INTO public.chemical_department_chemical_links (
    department_sds_id,
    product_id,
    holding_id,
    sds_version_id,
    linked_by
  ) VALUES (
    p_department_sds_id,
    holding_product_id,
    p_holding_id,
    sds_version_id,
    p_actor_id
  )
  RETURNING id INTO link_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.department_sds.link_existing',
    p_actor_id,
    link_id::text,
    jsonb_build_object(
      'department_sds_id', p_department_sds_id,
      'product_id', holding_product_id,
      'holding_id', p_holding_id,
      'sds_version_id', sds_version_id
    )::text
  );

  RETURN link_id;
END;
$$;

REVOKE ALL ON FUNCTION public.link_department_sds_to_existing_holding(uuid, uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_department_sds_to_existing_holding(uuid, uuid, uuid)
  TO service_role;

DO $$
DECLARE
  actor_id uuid;
  source_row record;
BEGIN
  SELECT profile.id
  INTO actor_id
  FROM public.profiles AS profile
  WHERE profile.role::text = 'Admin'
  ORDER BY profile.name NULLS LAST, profile.id
  LIMIT 1;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'chemical_sds_only_actor_not_found';
  END IF;

  FOR source_row IN
    SELECT entry.id
    FROM public.chemical_department_sds AS entry
    WHERE entry.file_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.chemical_department_chemical_links AS link
        WHERE link.department_sds_id = entry.id
      )
    ORDER BY entry.department_code, entry.display_name, entry.id
  LOOP
    PERFORM public.register_department_sds_as_sds_only(source_row.id, actor_id);
  END LOOP;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
