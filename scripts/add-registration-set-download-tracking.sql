-- Tracks when a registration set (main document + supporting documents) was last
-- downloaded as ZIP, via either the per-set download button or the multi-select bulk
-- download. Team-wide indicator (overwritten by whoever downloads most recently),
-- shown as a badge on the pending page's RegistrationSetCard.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS set_last_downloaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS set_last_downloaded_by_name text;
