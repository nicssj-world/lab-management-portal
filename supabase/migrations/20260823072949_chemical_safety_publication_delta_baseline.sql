-- Keep the last successful department publication separate from the current
-- draft/published gate so a newly linked item can use incremental update copy.
BEGIN;

ALTER TABLE public.chemical_sds_departments
  ADD COLUMN IF NOT EXISTS last_published_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS last_published_at timestamptz;

UPDATE public.chemical_sds_departments
SET last_published_by = published_by,
    last_published_at = published_at
WHERE status = 'published'
  AND last_published_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_chemical_sds_department_publication_status(
  p_department_code text, p_status text, p_actor_id uuid
) RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  department_row public.chemical_sds_departments%rowtype;
  legacy_count bigint;
  registry_count bigint;
BEGIN
  IF p_actor_id IS NULL THEN RAISE EXCEPTION 'actor_required'; END IF;
  IF p_status NOT IN ('draft', 'published') THEN RAISE EXCEPTION 'invalid_department_sds_status'; END IF;

  SELECT * INTO department_row
  FROM public.chemical_sds_departments AS department
  WHERE department.code = p_department_code
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'department_sds_not_found'; END IF;

  IF p_status = 'published' THEN
    SELECT count(*) INTO legacy_count
    FROM public.chemical_department_sds AS entry
    WHERE entry.department_code = p_department_code;

    SELECT count(*) INTO registry_count
    FROM public.chemical_sds_publications AS publication
    WHERE publication.department_code = p_department_code
      AND publication.destination = 'department'
      AND publication.status = 'active';

    IF legacy_count + registry_count = 0 THEN
      RAISE EXCEPTION 'department_sds_empty';
    END IF;
  END IF;

  UPDATE public.chemical_sds_departments
  SET status = p_status,
    published_by = CASE WHEN p_status = 'published' THEN p_actor_id ELSE NULL END,
    published_at = CASE WHEN p_status = 'published' THEN now() ELSE NULL END,
    last_published_by = CASE WHEN p_status = 'published' THEN p_actor_id ELSE NULL END,
    last_published_at = CASE WHEN p_status = 'published' THEN now() ELSE NULL END,
    updated_at = now()
  WHERE code = p_department_code;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES ('chemical_safety.department_sds.publish', p_actor_id, p_department_code,
    jsonb_build_object('department', department_row.department, 'status', p_status)::text);
  RETURN p_status;
END;
$$;

COMMIT;

NOTIFY pgrst, 'reload schema';
