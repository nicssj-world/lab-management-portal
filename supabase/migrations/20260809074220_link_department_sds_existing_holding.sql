-- ผูกไฟล์ SDS แยกตามงานกับ holding เดิม โดยไม่สร้าง product หรือ stock ซ้ำ
CREATE OR REPLACE FUNCTION public.link_department_sds_to_existing_holding(
  p_department_sds_id uuid,
  p_holding_id uuid,
  p_actor_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER SET search_path = '' AS $$
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
  IF holding_unit_product_active IS DISTINCT FROM true OR holding_product_status <> 'active' THEN
    RAISE EXCEPTION 'department_holding_inactive';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.chemical_department_chemical_links AS link
    WHERE link.holding_id = p_holding_id
  ) THEN
    RAISE EXCEPTION 'department_holding_already_linked';
  END IF;

  SELECT version.id
  INTO sds_version_id
  FROM public.chemical_sds_versions AS version
  WHERE version.product_id = holding_product_id
    AND version.file_id = source_file_id
  ORDER BY version.created_at DESC
  LIMIT 1;

  IF sds_version_id IS NULL THEN
    INSERT INTO public.chemical_sds_versions (
      product_id,
      file_id,
      language,
      status,
      created_by
    ) VALUES (
      holding_product_id,
      source_file_id,
      'th',
      'draft',
      p_actor_id
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

REVOKE ALL ON FUNCTION public.link_department_sds_to_existing_holding(uuid,uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_department_sds_to_existing_holding(uuid,uuid,uuid)
  TO service_role;
