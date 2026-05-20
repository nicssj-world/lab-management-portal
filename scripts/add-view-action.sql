-- Add 'view' action type to document_access_logs constraint
ALTER TABLE document_access_logs
  DROP CONSTRAINT IF EXISTS document_access_logs_action_check;

ALTER TABLE document_access_logs
  ADD CONSTRAINT document_access_logs_action_check
  CHECK (action IN ('upload', 'download', 'edit', 'delete', 'publish', 'view'));
