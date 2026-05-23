-- Add related_doc_ids column to tests table
-- Links tests to documents in the quality documents module (documents table)
ALTER TABLE tests ADD COLUMN IF NOT EXISTS related_doc_ids uuid[] DEFAULT '{}';
