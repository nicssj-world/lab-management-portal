-- Extend doc_type check constraint to include new document types
-- Run via Supabase Dashboard → SQL Editor

ALTER TABLE test_documents
  DROP CONSTRAINT IF EXISTS test_documents_doc_type_check;

ALTER TABLE test_documents
  ADD CONSTRAINT test_documents_doc_type_check
  CHECK (doc_type IN (
    'QP',
    'WI',
    'RF',
    'Form',
    'Method Validation',
    'Method Correlation',
    'Measurement Uncertainty',
    'Other'
  ));
