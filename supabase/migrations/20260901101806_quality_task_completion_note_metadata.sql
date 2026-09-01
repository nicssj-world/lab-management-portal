-- Keep meeting-summary save metadata separate from generic occurrence edits.
ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS completion_note_updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS completion_note_updated_at timestamptz;

-- Preserve metadata for summaries that were already saved together with completion.
UPDATE public.quality_task_instances
SET completion_note_updated_by = completed_by,
    completion_note_updated_at = completed_at
WHERE completion_note IS NOT NULL
  AND completion_note_updated_by IS NULL
  AND completion_note_updated_at IS NULL
  AND completed_by IS NOT NULL
  AND completed_at IS NOT NULL;

NOTIFY pgrst, 'reload schema';
