-- Repair the immediate-apply registry workflow on environments where the
-- approval-removal migration was already run before this constraint was
-- included in it.

BEGIN;

ALTER TABLE public.chemical_change_requests
  DROP CONSTRAINT IF EXISTS chemical_change_no_self_review;

COMMIT;

NOTIFY pgrst, 'reload schema';
