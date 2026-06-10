-- Add Reference and Card file to documents.type CHECK constraint
-- Run in Supabase Dashboard > SQL Editor

ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_type_check;

ALTER TABLE documents
  ADD CONSTRAINT documents_type_check
  CHECK (type IN ('QP','WI','Form','Policy','Manual','Record','Reference','Card file','Others'));
