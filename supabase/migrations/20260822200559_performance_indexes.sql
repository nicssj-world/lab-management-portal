-- Targeted indexes for the highest-traffic audit/read-log and rejection queries.
-- These are additive only: no data or existing indexes are removed.

CREATE INDEX IF NOT EXISTS document_access_logs_document_action_created_at_idx
  ON public.document_access_logs (document_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS document_access_logs_user_id_idx
  ON public.document_access_logs (user_id);

CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
  ON public.audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_target_created_at_idx
  ON public.audit_log (target, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_user_id_idx
  ON public.audit_log (user_id);

CREATE INDEX IF NOT EXISTS rejection_logs_spcmdate_uploaded_at_idx
  ON public.rejection_logs (spcmdate DESC, uploaded_at DESC);
