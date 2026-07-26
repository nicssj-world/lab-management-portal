-- Chemical registry, inventory, SDS review, imports, and QR token storage.
-- Run after scripts/migration.sql and scripts/lab-map-module.sql.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
        OR statement->>'code' !~ ('^' || p_prefix || '[0-9]{3}$')
        OR nullif(btrim(statement->>'text'), '') IS NULL
    );
$$;

CREATE TABLE IF NOT EXISTS public.chemical_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemical_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name_th text NOT NULL,
  map_space_code text REFERENCES public.lab_map_spaces(code) ON UPDATE CASCADE ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemical_storage_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.chemical_rooms(id) ON DELETE RESTRICT,
  code text NOT NULL,
  zone_code text NOT NULL CHECK (zone_code IN ('A','B','C','T')),
  location_kind text NOT NULL CHECK (location_kind IN ('cabinet','shelf','table')),
  display_order integer NOT NULL CHECK (display_order > 0),
  display_geometry jsonb,
  active boolean NOT NULL DEFAULT true,
  UNIQUE (room_id, code)
);

CREATE TABLE IF NOT EXISTS public.chemical_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  cas_number text,
  manufacturer text,
  supplier text,
  product_code text,
  concentration text,
  physical_state text CHECK (physical_state IS NULL OR physical_state IN ('solid','liquid','gas','mixture','unknown')),
  lifecycle_status text NOT NULL DEFAULT 'active' CHECK (lifecycle_status IN ('active','retired')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemical_product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.chemical_products(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text NOT NULL,
  UNIQUE (product_id, normalized_alias)
);

CREATE TABLE IF NOT EXISTS public.chemical_unit_products (
  product_id uuid NOT NULL REFERENCES public.chemical_products(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.chemical_units(id) ON DELETE RESTRICT,
  preferred_name text,
  active boolean NOT NULL DEFAULT true,
  public_eligible boolean NOT NULL DEFAULT false,
  PRIMARY KEY (product_id, unit_id)
);

CREATE TABLE IF NOT EXISTS public.chemical_inventory_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.chemical_products(id) ON DELETE RESTRICT,
  unit_id uuid NOT NULL REFERENCES public.chemical_units(id) ON DELETE RESTRICT,
  location_id uuid NOT NULL REFERENCES public.chemical_storage_locations(id) ON DELETE RESTRICT,
  lot_number text,
  package_value numeric NOT NULL CHECK (package_value >= 0),
  package_unit text NOT NULL,
  current_container_count integer NOT NULL DEFAULT 0 CHECK (current_container_count >= 0),
  minimum_stock numeric NOT NULL DEFAULT 0 CHECK (minimum_stock >= 0),
  reported_total_raw text,
  calculated_total_value numeric CHECK (calculated_total_value IS NULL OR calculated_total_value >= 0),
  calculated_total_unit text,
  received_on date,
  opened_on date,
  expires_on date,
  effective_on date,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemical_sds_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  r2_key text NOT NULL UNIQUE,
  file_name text NOT NULL,
  content_type text NOT NULL,
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 52428800),
  source_paths jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(source_paths) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chemical_sds_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.chemical_products(id) ON DELETE RESTRICT,
  file_id uuid REFERENCES public.chemical_sds_files(id) ON DELETE RESTRICT,
  source_url text,
  manufacturer text,
  supplier text,
  product_code text,
  concentration text,
  language text,
  revision_label text,
  effective_on date,
  review_due_on date,
  signal_word text,
  pictogram_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  h_statements jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (public.chemical_sds_statements_valid(h_statements, 'H')),
  p_statements jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (public.chemical_sds_statements_valid(p_statements, 'P')),
  storage_instructions text,
  incompatibilities text,
  emergency_summary text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','superseded','rejected')),
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chemical_sds_no_self_review CHECK (
    reviewed_by IS NULL OR submitted_by IS NULL OR reviewed_by <> submitted_by
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chemical_sds_one_approved_per_product
  ON public.chemical_sds_versions(product_id) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS public.chemical_sds_hazards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sds_version_id uuid NOT NULL REFERENCES public.chemical_sds_versions(id) ON DELETE CASCADE,
  hazard_class text NOT NULL,
  hazard_category text NOT NULL,
  UNIQUE (sds_version_id, hazard_class, hazard_category)
);

CREATE TABLE IF NOT EXISTS public.chemical_role_scopes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.chemical_units(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('custodian','reviewer')),
  PRIMARY KEY (user_id, unit_id, role)
);

CREATE TABLE IF NOT EXISTS public.chemical_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('product','holding')),
  entity_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.chemical_units(id) ON DELETE RESTRICT,
  proposed_data jsonb NOT NULL CHECK (jsonb_typeof(proposed_data) = 'object'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','rejected')),
  submitted_by uuid REFERENCES public.profiles(id),
  submitted_at timestamptz,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_reason text,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chemical_change_no_self_review CHECK (
    reviewed_by IS NULL OR submitted_by IS NULL OR reviewed_by <> submitted_by
  )
);

CREATE TABLE IF NOT EXISTS public.chemical_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_kind text NOT NULL,
  source_name text NOT NULL,
  source_path text,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_r2_key text,
  parser_version text NOT NULL,
  status text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(summary) = 'object'),
  imported_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_kind, source_sha256)
);

CREATE TABLE IF NOT EXISTS public.chemical_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.chemical_import_batches(id) ON DELETE CASCADE,
  row_key text NOT NULL,
  raw_data jsonb NOT NULL,
  normalized_data jsonb,
  match_status text NOT NULL,
  conflict_codes text[] NOT NULL DEFAULT ARRAY[]::text[],
  target_product_id uuid REFERENCES public.chemical_products(id) ON DELETE SET NULL,
  decision_note text,
  decided_by uuid REFERENCES public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, row_key)
);

CREATE TABLE IF NOT EXISTS public.chemical_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_by uuid REFERENCES public.profiles(id),
  revoked_at timestamptz,
  CONSTRAINT chemical_qr_revocation_pair CHECK ((revoked_by IS NULL) = (revoked_at IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_chemical_alias_normalized
  ON public.chemical_product_aliases(normalized_alias);
CREATE INDEX IF NOT EXISTS idx_chemical_holdings_product_unit
  ON public.chemical_inventory_holdings(product_id, unit_id);
CREATE INDEX IF NOT EXISTS idx_chemical_holdings_location
  ON public.chemical_inventory_holdings(location_id);
CREATE INDEX IF NOT EXISTS idx_chemical_sds_product_status
  ON public.chemical_sds_versions(product_id, status);
CREATE INDEX IF NOT EXISTS idx_chemical_change_status_unit
  ON public.chemical_change_requests(status, unit_id);
CREATE INDEX IF NOT EXISTS idx_chemical_import_rows_batch_status
  ON public.chemical_import_rows(batch_id, match_status);

ALTER TABLE public.chemical_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_storage_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_unit_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_inventory_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_sds_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_sds_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_sds_hazards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_role_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_qr_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.chemical_units, public.chemical_rooms,
  public.chemical_storage_locations, public.chemical_products,
  public.chemical_product_aliases, public.chemical_unit_products,
  public.chemical_inventory_holdings, public.chemical_sds_files,
  public.chemical_sds_versions, public.chemical_sds_hazards,
  public.chemical_role_scopes, public.chemical_change_requests,
  public.chemical_import_batches, public.chemical_import_rows,
  public.chemical_qr_tokens
  FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chemical_units, public.chemical_rooms,
  public.chemical_storage_locations, public.chemical_products,
  public.chemical_product_aliases, public.chemical_unit_products,
  public.chemical_inventory_holdings, public.chemical_sds_files,
  public.chemical_sds_versions, public.chemical_sds_hazards,
  public.chemical_role_scopes, public.chemical_change_requests,
  public.chemical_import_batches, public.chemical_import_rows,
  public.chemical_qr_tokens
  TO service_role;
REVOKE ALL ON FUNCTION public.chemical_sds_statements_valid(jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.chemical_sds_statements_valid(jsonb,text)
  TO service_role;

INSERT INTO public.chemical_rooms (code, name_th, map_space_code)
VALUES ('chemical-prep', 'ห้องเตรียมสารเคมี', 'chemical-prep')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.chemical_storage_locations
  (room_id, code, zone_code, location_kind, display_order)
SELECT room.id, location.code, location.zone_code, location.location_kind, location.display_order
FROM public.chemical_rooms room
CROSS JOIN (VALUES
  ('A1', 'A', 'cabinet', 1), ('A2', 'A', 'cabinet', 2),
  ('B1', 'B', 'cabinet', 3), ('B2', 'B', 'cabinet', 4),
  ('B3', 'B', 'cabinet', 5), ('B4', 'B', 'cabinet', 6),
  ('C1', 'C', 'cabinet', 7), ('C2', 'C', 'cabinet', 8),
  ('C3', 'C', 'cabinet', 9), ('C4', 'C', 'cabinet', 10),
  ('C5', 'C', 'cabinet', 11), ('T1', 'T', 'table', 12),
  ('T2', 'T', 'table', 13)
) AS location(code, zone_code, location_kind, display_order)
WHERE room.code = 'chemical-prep'
ON CONFLICT (room_id, code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.submit_chemical_change_request(
  p_request_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_row public.chemical_change_requests%rowtype;
BEGIN
  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.status <> 'draft' THEN RAISE EXCEPTION 'change_request_not_draft'; END IF;

  UPDATE public.chemical_change_requests
  SET status = 'in_review', submitted_by = p_actor_id, submitted_at = now(), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.change_request.submit', p_actor_id, p_request_id::text,
    jsonb_build_object('before', current_row.status, 'after', 'in_review')::text
  );
  RETURN p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_chemical_change_request(
  p_request_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_change_requests%rowtype;
  affected_rows integer;
  product_keys constant text[] := ARRAY[
    'canonical_name', 'cas_number', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'physical_state', 'lifecycle_status'
  ];
  holding_keys constant text[] := ARRAY[
    'product_id', 'unit_id', 'location_id', 'lot_number', 'package_value',
    'package_unit', 'current_container_count', 'minimum_stock', 'reported_total_raw',
    'calculated_total_value', 'calculated_total_unit', 'received_on', 'opened_on',
    'expires_on', 'effective_on'
  ];
BEGIN
  SELECT * INTO current_row
  FROM public.chemical_change_requests
  WHERE id = p_request_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'change_request_not_found'; END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'change_request_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;

  IF p_decision = 'approved' AND current_row.entity_type = 'product' THEN
    IF NOT current_row.proposed_data ?& product_keys
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(product_keys))
      )
      OR nullif(btrim(current_row.proposed_data->>'canonical_name'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'canonical_name') <> 'string'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'cas_number', 'manufacturer', 'supplier', 'product_code',
          'concentration', 'physical_state'
        ])
          AND jsonb_typeof(value) NOT IN ('string','null')
      )
      OR current_row.proposed_data->>'lifecycle_status' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'lifecycle_status') <> 'string'
      OR current_row.proposed_data->>'lifecycle_status' NOT IN ('active','retired')
      OR (
        current_row.proposed_data->>'physical_state' IS NOT NULL
        AND current_row.proposed_data->>'physical_state' NOT IN ('solid','liquid','gas','mixture','unknown')
      )
    THEN RAISE EXCEPTION 'invalid_product_snapshot'; END IF;

    UPDATE public.chemical_products
    SET canonical_name = current_row.proposed_data->>'canonical_name',
      cas_number = current_row.proposed_data->>'cas_number',
      manufacturer = current_row.proposed_data->>'manufacturer',
      supplier = current_row.proposed_data->>'supplier',
      product_code = current_row.proposed_data->>'product_code',
      concentration = current_row.proposed_data->>'concentration',
      physical_state = current_row.proposed_data->>'physical_state',
      lifecycle_status = current_row.proposed_data->>'lifecycle_status',
      updated_at = now()
    WHERE id = current_row.entity_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION 'chemical_product_not_found'; END IF;
  ELSIF p_decision = 'approved' AND current_row.entity_type = 'holding' THEN
    IF NOT current_row.proposed_data ?& holding_keys
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(current_row.proposed_data) AS proposed_key(key)
        WHERE NOT (key = ANY(holding_keys))
      )
      OR nullif(btrim(current_row.proposed_data->>'product_id'), '') IS NULL
      OR nullif(btrim(current_row.proposed_data->>'unit_id'), '') IS NULL
      OR nullif(btrim(current_row.proposed_data->>'location_id'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'product_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'unit_id') <> 'string'
      OR jsonb_typeof(current_row.proposed_data->'location_id') <> 'string'
      OR current_row.proposed_data->>'package_value' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'package_value') <> 'number'
      OR nullif(btrim(current_row.proposed_data->>'package_unit'), '') IS NULL
      OR jsonb_typeof(current_row.proposed_data->'package_unit') <> 'string'
      OR current_row.proposed_data->>'current_container_count' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'current_container_count') <> 'number'
      OR current_row.proposed_data->>'minimum_stock' IS NULL
      OR jsonb_typeof(current_row.proposed_data->'minimum_stock') <> 'number'
      OR EXISTS (
        SELECT 1
        FROM jsonb_each(current_row.proposed_data) AS proposed_value(key, value)
        WHERE key = ANY(ARRAY[
          'lot_number', 'reported_total_raw', 'calculated_total_unit',
          'received_on', 'opened_on', 'expires_on', 'effective_on'
        ])
          AND jsonb_typeof(value) NOT IN ('string','null')
      )
      OR jsonb_typeof(current_row.proposed_data->'calculated_total_value') NOT IN ('number','null')
      OR (current_row.proposed_data->>'unit_id')::uuid <> current_row.unit_id
      OR (current_row.proposed_data->>'package_value')::numeric < 0
      OR (current_row.proposed_data->>'current_container_count')::integer < 0
      OR (current_row.proposed_data->>'minimum_stock')::numeric < 0
      OR (
        current_row.proposed_data->>'calculated_total_value' IS NOT NULL
        AND (current_row.proposed_data->>'calculated_total_value')::numeric < 0
      )
    THEN RAISE EXCEPTION 'invalid_holding_snapshot'; END IF;

    UPDATE public.chemical_inventory_holdings
    SET product_id = (current_row.proposed_data->>'product_id')::uuid,
      unit_id = (current_row.proposed_data->>'unit_id')::uuid,
      location_id = (current_row.proposed_data->>'location_id')::uuid,
      lot_number = current_row.proposed_data->>'lot_number',
      package_value = (current_row.proposed_data->>'package_value')::numeric,
      package_unit = current_row.proposed_data->>'package_unit',
      current_container_count = (current_row.proposed_data->>'current_container_count')::integer,
      minimum_stock = (current_row.proposed_data->>'minimum_stock')::numeric,
      reported_total_raw = current_row.proposed_data->>'reported_total_raw',
      calculated_total_value = (current_row.proposed_data->>'calculated_total_value')::numeric,
      calculated_total_unit = current_row.proposed_data->>'calculated_total_unit',
      received_on = (current_row.proposed_data->>'received_on')::date,
      opened_on = (current_row.proposed_data->>'opened_on')::date,
      expires_on = (current_row.proposed_data->>'expires_on')::date,
      effective_on = (current_row.proposed_data->>'effective_on')::date,
      approved_by = p_actor_id, approved_at = now(), updated_at = now()
    WHERE id = current_row.entity_id;
    GET DIAGNOSTICS affected_rows = ROW_COUNT;
    IF affected_rows <> 1 THEN RAISE EXCEPTION 'chemical_holding_not_found'; END IF;
  END IF;

  UPDATE public.chemical_change_requests
  SET status = p_decision, reviewed_by = p_actor_id, reviewed_at = now(),
    review_reason = nullif(btrim(p_reason), ''), updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.change_request.review', p_actor_id, p_request_id::text,
    jsonb_build_object(
      'before', current_row.status, 'after', p_decision, 'reason', p_reason,
      'entity_type', current_row.entity_type, 'entity_id', current_row.entity_id,
      'proposed_data', current_row.proposed_data
    )::text
  );
  RETURN p_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_chemical_sds_draft(
  p_version_id uuid, p_actor_id uuid, p_expected_updated_at timestamptz,
  p_metadata jsonb, p_hazards jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  current_row public.chemical_sds_versions%rowtype;
  metadata_keys constant text[] := ARRAY[
    'file_id', 'source_url', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'language', 'revision_label', 'effective_on', 'review_due_on',
    'signal_word', 'pictogram_codes', 'h_statements', 'p_statements',
    'storage_instructions', 'incompatibilities', 'emergency_summary'
  ];
  metadata_text_keys constant text[] := ARRAY[
    'file_id', 'source_url', 'manufacturer', 'supplier', 'product_code',
    'concentration', 'language', 'revision_label', 'effective_on', 'review_due_on',
    'signal_word', 'storage_instructions', 'incompatibilities', 'emergency_summary'
  ];
  before_detail jsonb;
  after_detail jsonb;
BEGIN
  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  IF current_row.status <> 'draft' THEN RAISE EXCEPTION 'sds_not_draft'; END IF;
  IF p_actor_id IS DISTINCT FROM current_row.created_by
    AND p_actor_id IS DISTINCT FROM current_row.submitted_by
  THEN RAISE EXCEPTION 'sds_draft_edit_forbidden'; END IF;
  IF current_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'stale_sds_draft';
  END IF;
  IF jsonb_typeof(p_metadata) IS DISTINCT FROM 'object'
    OR EXISTS (
      SELECT 1 FROM jsonb_object_keys(p_metadata) AS metadata_key(key)
      WHERE NOT (key = ANY(metadata_keys))
    )
    OR EXISTS (
      SELECT 1 FROM jsonb_each(p_metadata) AS metadata_value(key, value)
      WHERE key = ANY(metadata_text_keys)
        AND jsonb_typeof(value) NOT IN ('string','null')
    )
    OR (p_metadata ? 'pictogram_codes' AND jsonb_typeof(p_metadata->'pictogram_codes') IS DISTINCT FROM 'array')
    OR (p_metadata ? 'h_statements' AND jsonb_typeof(p_metadata->'h_statements') IS DISTINCT FROM 'array')
    OR (p_metadata ? 'p_statements' AND jsonb_typeof(p_metadata->'p_statements') IS DISTINCT FROM 'array')
  THEN RAISE EXCEPTION 'invalid_sds_metadata'; END IF;

  IF p_metadata ? 'pictogram_codes' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'pictogram_codes') AS pictogram(code)
    WHERE jsonb_typeof(code) <> 'string'
      OR code #>> '{}' NOT IN (
        'GHS01','GHS02','GHS03','GHS04','GHS05','GHS06','GHS07','GHS08','GHS09'
      )
  ) THEN RAISE EXCEPTION 'invalid_pictogram_codes'; END IF;

  IF p_metadata ? 'h_statements' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'h_statements') AS statement
    WHERE jsonb_typeof(statement) <> 'object'
      OR NOT statement ?& ARRAY['code','text']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
        WHERE key NOT IN ('code','text')
      )
      OR statement->>'code' !~ '^H[0-9]{3}$'
      OR nullif(btrim(statement->>'text'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_h_statements'; END IF;

  IF p_metadata ? 'p_statements' AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_metadata->'p_statements') AS statement
    WHERE jsonb_typeof(statement) <> 'object'
      OR NOT statement ?& ARRAY['code','text']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(statement) AS statement_key(key)
        WHERE key NOT IN ('code','text')
      )
      OR statement->>'code' !~ '^P[0-9]{3}$'
      OR nullif(btrim(statement->>'text'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_p_statements'; END IF;

  IF jsonb_typeof(p_hazards) IS DISTINCT FROM 'array' OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_hazards) AS hazard
    WHERE jsonb_typeof(hazard) <> 'object'
      OR NOT hazard ?& ARRAY['hazard_class','hazard_category']
      OR EXISTS (
        SELECT 1 FROM jsonb_object_keys(hazard) AS hazard_key(key)
        WHERE key NOT IN ('hazard_class','hazard_category')
      )
      OR nullif(btrim(hazard->>'hazard_class'), '') IS NULL
      OR nullif(btrim(hazard->>'hazard_category'), '') IS NULL
  ) THEN RAISE EXCEPTION 'invalid_sds_hazards'; END IF;

  before_detail := to_jsonb(current_row) || jsonb_build_object(
    'hazards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'hazard_class', hazard_class, 'hazard_category', hazard_category
      ) ORDER BY hazard_class, hazard_category)
      FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id
    ), '[]'::jsonb)
  );

  UPDATE public.chemical_sds_versions
  SET file_id = CASE WHEN p_metadata ? 'file_id' THEN (p_metadata->>'file_id')::uuid ELSE file_id END,
    source_url = CASE WHEN p_metadata ? 'source_url' THEN p_metadata->>'source_url' ELSE source_url END,
    manufacturer = CASE WHEN p_metadata ? 'manufacturer' THEN p_metadata->>'manufacturer' ELSE manufacturer END,
    supplier = CASE WHEN p_metadata ? 'supplier' THEN p_metadata->>'supplier' ELSE supplier END,
    product_code = CASE WHEN p_metadata ? 'product_code' THEN p_metadata->>'product_code' ELSE product_code END,
    concentration = CASE WHEN p_metadata ? 'concentration' THEN p_metadata->>'concentration' ELSE concentration END,
    language = CASE WHEN p_metadata ? 'language' THEN p_metadata->>'language' ELSE language END,
    revision_label = CASE WHEN p_metadata ? 'revision_label' THEN p_metadata->>'revision_label' ELSE revision_label END,
    effective_on = CASE WHEN p_metadata ? 'effective_on' THEN (p_metadata->>'effective_on')::date ELSE effective_on END,
    review_due_on = CASE WHEN p_metadata ? 'review_due_on' THEN (p_metadata->>'review_due_on')::date ELSE review_due_on END,
    signal_word = CASE WHEN p_metadata ? 'signal_word' THEN p_metadata->>'signal_word' ELSE signal_word END,
    pictogram_codes = CASE WHEN p_metadata ? 'pictogram_codes' THEN
      ARRAY(SELECT jsonb_array_elements_text(p_metadata->'pictogram_codes')) ELSE pictogram_codes END,
    h_statements = CASE WHEN p_metadata ? 'h_statements' THEN p_metadata->'h_statements' ELSE h_statements END,
    p_statements = CASE WHEN p_metadata ? 'p_statements' THEN p_metadata->'p_statements' ELSE p_statements END,
    storage_instructions = CASE WHEN p_metadata ? 'storage_instructions' THEN p_metadata->>'storage_instructions' ELSE storage_instructions END,
    incompatibilities = CASE WHEN p_metadata ? 'incompatibilities' THEN p_metadata->>'incompatibilities' ELSE incompatibilities END,
    emergency_summary = CASE WHEN p_metadata ? 'emergency_summary' THEN p_metadata->>'emergency_summary' ELSE emergency_summary END,
    updated_at = now()
  WHERE id = p_version_id;

  DELETE FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id;
  INSERT INTO public.chemical_sds_hazards (sds_version_id, hazard_class, hazard_category)
  SELECT p_version_id, hazard->>'hazard_class', hazard->>'hazard_category'
  FROM jsonb_array_elements(p_hazards) AS hazard;

  SELECT to_jsonb(version_row) || jsonb_build_object(
    'hazards', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'hazard_class', hazard_class, 'hazard_category', hazard_category
      ) ORDER BY hazard_class, hazard_category)
      FROM public.chemical_sds_hazards WHERE sds_version_id = p_version_id
    ), '[]'::jsonb)
  ) INTO after_detail
  FROM public.chemical_sds_versions AS version_row
  WHERE version_row.id = p_version_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.draft_update', p_actor_id, p_version_id::text,
    jsonb_build_object('before', before_detail, 'after', after_detail)::text
  );
  RETURN p_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_chemical_sds_version(
  p_version_id uuid, p_actor_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_row public.chemical_sds_versions%rowtype;
BEGIN
  SELECT * INTO current_row
  FROM public.chemical_sds_versions
  WHERE id = p_version_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  IF current_row.status <> 'draft' THEN RAISE EXCEPTION 'sds_not_draft'; END IF;

  UPDATE public.chemical_sds_versions
  SET status = 'in_review', submitted_by = p_actor_id, submitted_at = now(), updated_at = now()
  WHERE id = p_version_id;

  INSERT INTO public.audit_log(action, user_id, target, detail)
  VALUES (
    'chemical_safety.sds.submit', p_actor_id, p_version_id::text,
    jsonb_build_object('before', current_row.status, 'after', 'in_review')::text
  );
  RETURN p_version_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_chemical_sds_version(
  p_version_id uuid, p_actor_id uuid, p_decision text, p_reason text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE current_row public.chemical_sds_versions%rowtype;
BEGIN
  SELECT * INTO current_row FROM public.chemical_sds_versions
    WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sds_not_found'; END IF;
  IF current_row.status <> 'in_review' THEN RAISE EXCEPTION 'sds_not_in_review'; END IF;
  IF current_row.submitted_by = p_actor_id THEN RAISE EXCEPTION 'self_approval_forbidden'; END IF;
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid_decision'; END IF;
  IF p_decision = 'approved' THEN
    PERFORM 1 FROM public.chemical_products
      WHERE id = current_row.product_id FOR UPDATE;
    UPDATE public.chemical_sds_versions SET status = 'superseded', updated_at = now()
      WHERE product_id = current_row.product_id AND status = 'approved' AND id <> p_version_id;
  END IF;
  UPDATE public.chemical_sds_versions SET status = p_decision,
    reviewed_by = p_actor_id, reviewed_at = now(), review_reason = nullif(btrim(p_reason), ''),
    updated_at = now()
    WHERE id = p_version_id;
  INSERT INTO public.audit_log(action, user_id, target, detail)
    VALUES ('chemical_safety.sds.review', p_actor_id, p_version_id::text,
      jsonb_build_object('before', current_row.status, 'after', p_decision, 'reason', p_reason)::text);
  RETURN p_version_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_chemical_change_request(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_chemical_change_request(uuid,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_change_request(uuid,uuid,text,text)
  TO service_role;
REVOKE ALL ON FUNCTION public.update_chemical_sds_draft(uuid,uuid,timestamptz,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_chemical_sds_draft(uuid,uuid,timestamptz,jsonb,jsonb)
  TO service_role;
REVOKE ALL ON FUNCTION public.submit_chemical_sds_version(uuid,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_chemical_sds_version(uuid,uuid)
  TO service_role;
REVOKE ALL ON FUNCTION public.review_chemical_sds_version(uuid,uuid,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_chemical_sds_version(uuid,uuid,text,text)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
