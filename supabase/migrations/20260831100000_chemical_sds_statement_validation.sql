-- Keep the live SDS save RPC aligned with the H/P formats accepted by the API
-- and by the reusable table validator.
--
-- The approval-removal migration copied an older update RPC which still
-- accepted only H123/P123. Real SDS files also use suffixes such as H350i and
-- combined precautionary codes such as P301+P310. With the old RPC, the
-- metadata update could be rejected even though the form and table schema
-- accepted the value.

BEGIN;

CREATE OR REPLACE FUNCTION public.chemical_sds_statements_valid(
  p_statements jsonb, p_prefix text
) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(p_statements) = 'array'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_statements) AS statement
      WHERE jsonb_typeof(statement) <> 'object'
        OR NOT statement ?& ARRAY['code','text']
        OR EXISTS (
          SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
          WHERE key NOT IN ('code','text')
        )
        OR jsonb_typeof(statement->'code') <> 'string'
        OR jsonb_typeof(statement->'text') <> 'string'
        OR statement->>'code' !~ (
          CASE
            WHEN p_prefix = 'H' THEN '^H[0-9]{3}[A-Za-z]{0,2}$'
            ELSE '^P[0-9]{3}(\+P?[0-9]{3})*$'
          END
        )
        OR nullif(btrim(statement->>'text'), '') IS NULL
    );
$$;

DO $migration$
DECLARE
  definition text;
  original text;
  h_old constant text := $h_old$statement->>'code' !~ '^H[0-9]{3}$'$h_old$;
  h_new constant text := $h_new$statement->>'code' !~ '^H[0-9]{3}[A-Za-z]{0,2}$'$h_new$;
  p_old constant text := $p_old$statement->>'code' !~ '^P[0-9]{3}$'$p_old$;
  p_new constant text := $p_new$statement->>'code' !~ '^P[0-9]{3}(\+P?[0-9]{3})*$'$p_new$;
BEGIN
  definition := pg_get_functiondef(
    'public.update_chemical_sds_draft(uuid,uuid,timestamptz,jsonb,jsonb)'::regprocedure
  );
  original := definition;
  IF position(h_new IN definition) = 0 AND position(h_old IN definition) = 0 THEN
    RAISE EXCEPTION 'update_chemical_sds_draft H statement validation marker not found';
  END IF;
  IF position(p_new IN definition) = 0 AND position(p_old IN definition) = 0 THEN
    RAISE EXCEPTION 'update_chemical_sds_draft P statement validation marker not found';
  END IF;
  definition := replace(definition, h_old, h_new);
  definition := replace(definition, p_old, p_new);
  IF definition <> original THEN EXECUTE definition; END IF;
END;
$migration$;

COMMIT;

NOTIFY pgrst, 'reload schema';
