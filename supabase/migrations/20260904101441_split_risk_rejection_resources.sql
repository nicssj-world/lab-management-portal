-- Keep Risk Management and Rejection independently configurable in the permission matrix.
-- The old combined resource granted access to two unrelated modules and made it
-- impossible to hide Rejection without also hiding the risk register.

DO $$
DECLARE
  old_resource text := 'ความเสี่ยง / Rejection';
BEGIN
  -- Preserve the existing effective level for both new resources. If a target
  -- row already exists, keep it so this migration never overwrites a deliberate
  -- independent setting.
  INSERT INTO public.role_permissions (role, resource, granted, updated_at, updated_by)
  SELECT
    source.role,
    target.resource || ':' || source.level,
    source.granted,
    source.updated_at,
    source.updated_by
  FROM (
    SELECT
      role,
      granted,
      updated_at,
      updated_by,
      CASE
        WHEN resource = old_resource THEN CASE WHEN granted THEN 'edit' ELSE 'none' END
        ELSE substring(resource FROM char_length(old_resource) + 2)
      END AS level
    FROM public.role_permissions
    WHERE resource = old_resource
       OR resource LIKE old_resource || ':%'
  ) AS source
  CROSS JOIN (VALUES ('ความเสี่ยง'), ('Rejection')) AS target(resource)
  WHERE source.level IN ('none', 'view', 'edit')
  ON CONFLICT (role, resource) DO NOTHING;

  DELETE FROM public.role_permissions
  WHERE resource = old_resource
     OR resource LIKE old_resource || ':%';
END $$;
