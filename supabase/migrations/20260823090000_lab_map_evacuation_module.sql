BEGIN;

ALTER TABLE public.quality_task_templates
  DROP CONSTRAINT IF EXISTS quality_task_templates_integration_kind_check;
ALTER TABLE public.quality_task_templates
  ADD CONSTRAINT quality_task_templates_integration_kind_check CHECK (
    integration_kind IN ('none', 'safety_inspection', 'equipment_reference', 'evacuation_plan_review', 'evacuation_drill')
  );

ALTER TABLE public.quality_task_links
  DROP CONSTRAINT IF EXISTS quality_task_links_integration_kind_check;
ALTER TABLE public.quality_task_links
  ADD CONSTRAINT quality_task_links_integration_kind_check CHECK (
    integration_kind IN (
      'safety_inspection', 'equipment_reference', 'risk_register', 'certificate_renewal',
      'evacuation_plan_review', 'evacuation_drill'
    )
  );

CREATE TABLE IF NOT EXISTS public.evacuation_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code text NOT NULL,
  version_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'approved', 'published', 'retired')),
  map_release_id uuid NOT NULL REFERENCES public.lab_map_versions(id) ON DELETE RESTRICT,
  effective_date date,
  review_due_date date,
  report_point_id uuid REFERENCES public.lab_map_assembly_points(id) ON DELETE RESTRICT,
  headcount_responsible text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_code, version_code),
  CHECK (NULLIF(btrim(plan_code), '') IS NOT NULL),
  CHECK (NULLIF(btrim(version_code), '') IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS evacuation_one_published_plan
  ON public.evacuation_plan_versions ((status)) WHERE status = 'published';

CREATE OR REPLACE FUNCTION public.publish_evacuation_plan(target_plan_id uuid)
RETURNS SETOF public.evacuation_plan_versions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('lab_map.evacuation.publish'));
  IF NOT EXISTS (
    SELECT 1 FROM public.evacuation_plan_versions
    WHERE id = target_plan_id AND status = 'approved'
  ) THEN
    RAISE EXCEPTION 'evacuation plan must be approved before publish';
  END IF;
  UPDATE public.evacuation_plan_versions
  SET status = 'retired', updated_at = now()
  WHERE status = 'published' AND id <> target_plan_id;
  RETURN QUERY
    UPDATE public.evacuation_plan_versions
    SET status = 'published', updated_at = now()
    WHERE id = target_plan_id AND status = 'approved'
    RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.publish_evacuation_plan(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_evacuation_plan(uuid) TO service_role;

CREATE TABLE IF NOT EXISTS public.evacuation_exit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.evacuation_plan_versions(id) ON DELETE CASCADE,
  scope_type text NOT NULL CHECK (scope_type IN ('station', 'space', 'zone')),
  scope_code text NOT NULL,
  exit_code text NOT NULL REFERENCES public.lab_map_access_points(code) ON UPDATE CASCADE ON DELETE RESTRICT,
  route_variant text NOT NULL CHECK (route_variant IN ('primary', 'alternate')),
  route_code text,
  assembly_point_id uuid NOT NULL REFERENCES public.lab_map_assembly_points(id) ON DELETE RESTRICT,
  post_exit_instruction_th text,
  responsible_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, scope_type, scope_code, route_variant),
  CHECK (NULLIF(btrim(scope_code), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS evacuation_exit_assignments_scope
  ON public.evacuation_exit_assignments(plan_version_id, scope_type, scope_code);

CREATE TABLE IF NOT EXISTS public.evacuation_drill_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL CHECK (fiscal_year BETWEEN 2500 AND 2700),
  plan_version_id uuid NOT NULL REFERENCES public.evacuation_plan_versions(id) ON DELETE RESTRICT,
  task_instance_id uuid NOT NULL REFERENCES public.quality_task_instances(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'awaiting_evidence', 'pending_review', 'completed', 'cancelled')),
  owner_text text NOT NULL,
  due_date date,
  notes text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fiscal_year, plan_version_id)
);

CREATE INDEX IF NOT EXISTS evacuation_drill_cycles_task
  ON public.evacuation_drill_cycles(task_instance_id, status);

CREATE TABLE IF NOT EXISTS public.evacuation_drill_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.evacuation_drill_cycles(id) ON DELETE CASCADE,
  scenario text NOT NULL CHECK (NULLIF(btrim(scenario), '') IS NOT NULL),
  started_at timestamptz,
  ended_at timestamptz,
  off_hours boolean NOT NULL DEFAULT false,
  scope_codes text[] NOT NULL DEFAULT '{}',
  route_codes text[] NOT NULL DEFAULT '{}',
  expected_participants integer NOT NULL DEFAULT 0 CHECK (expected_participants >= 0),
  actual_participants integer NOT NULL DEFAULT 0 CHECK (actual_participants >= 0),
  expected_headcount integer NOT NULL DEFAULT 0 CHECK (expected_headcount >= 0),
  checked_headcount integer NOT NULL DEFAULT 0 CHECK (checked_headcount >= 0),
  missing_headcount integer NOT NULL DEFAULT 0 CHECK (missing_headcount >= 0),
  injured_count integer NOT NULL DEFAULT 0 CHECK (injured_count >= 0),
  report_point_id uuid REFERENCES public.lab_map_assembly_points(id) ON DELETE RESTRICT,
  observer_text text,
  evaluation text,
  compliance_percent numeric(5,2) CHECK (compliance_percent BETWEEN 0 AND 100),
  deviation_text text,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CHECK ((expected_headcount = 0 AND checked_headcount = 0) OR checked_headcount <= expected_headcount),
  CHECK ((expected_headcount = 0 AND missing_headcount = 0) OR missing_headcount <= expected_headcount),
  CHECK ((expected_headcount = 0 AND checked_headcount = 0 AND missing_headcount = 0) OR checked_headcount + missing_headcount <= expected_headcount)
);

CREATE INDEX IF NOT EXISTS evacuation_drill_sessions_cycle
  ON public.evacuation_drill_sessions(cycle_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.evacuation_drill_evidence (
  session_id uuid NOT NULL REFERENCES public.evacuation_drill_sessions(id) ON DELETE CASCADE,
  attachment_id uuid NOT NULL REFERENCES public.quality_task_attachments(id) ON DELETE CASCADE,
  evidence_role text NOT NULL CHECK (evidence_role IN ('plan', 'attendance', 'evaluation', 'photo', 'incident')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, attachment_id)
);

CREATE INDEX IF NOT EXISTS evacuation_drill_evidence_attachment
  ON public.evacuation_drill_evidence(attachment_id);

ALTER TABLE public.evacuation_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_exit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_drill_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_drill_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_drill_evidence ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.evacuation_plan_versions, public.evacuation_exit_assignments,
  public.evacuation_drill_cycles, public.evacuation_drill_sessions,
  public.evacuation_drill_evidence FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evacuation_plan_versions,
  public.evacuation_exit_assignments, public.evacuation_drill_cycles,
  public.evacuation_drill_sessions, public.evacuation_drill_evidence TO service_role;

UPDATE public.quality_task_templates
SET integration_kind = 'evacuation_plan_review', updated_at = now()
WHERE source_key = 'CBH-ST-15' AND active;

UPDATE public.quality_task_templates
SET integration_kind = 'evacuation_drill', updated_at = now()
WHERE source_key IN ('CBH-ST-17', 'CBH-ST-21') AND active;

INSERT INTO public.quality_task_evidence_requirements (
  template_id, evidence_kind, label, required, minimum_files, sort_order
)
SELECT id, 'attendance', 'หลักฐานผู้เข้าร่วมและการนับคน', true, 1, 4
FROM public.quality_task_templates
WHERE source_key = 'CBH-ST-17'
ON CONFLICT (template_id, evidence_kind, label) DO UPDATE SET
  required = true, minimum_files = 1, sort_order = 4, active = true, updated_at = now();

NOTIFY pgrst, 'reload schema';
COMMIT;
