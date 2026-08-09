BEGIN;

-- Meeting coordination remains canonical in Quality Tasks because that module
-- owns participants, QR check-in, minutes, scheduling, and meeting history.
WITH primary_meeting AS (
  UPDATE public.quality_task_templates
  SET
    workstream = 'quality',
    active = true,
    superseded_by = null,
    updated_at = now()
  WHERE source_key = 'CBH-QT-42'
  RETURNING id
)
UPDATE public.quality_task_templates duplicate_meeting
SET
  active = false,
  superseded_by = primary_meeting.id,
  updated_at = now()
FROM primary_meeting
WHERE duplicate_meeting.source_key = 'CBH-ST-05';

NOTIFY pgrst, 'reload schema';
COMMIT;
