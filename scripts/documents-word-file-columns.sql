-- Add word/excel secondary file columns to documents table
-- Run via Supabase Dashboard → SQL Editor

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS word_url  text,
  ADD COLUMN IF NOT EXISTS word_name text,
  ADD COLUMN IF NOT EXISTS word_size bigint;
