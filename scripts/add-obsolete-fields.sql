-- Add obsolete tracking fields to documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS obsolete_date date,
  ADD COLUMN IF NOT EXISTS obsolete_reason text;
