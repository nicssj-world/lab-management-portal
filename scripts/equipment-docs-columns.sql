-- Add document attachment columns to equipment table
-- Run via Supabase Dashboard → SQL Editor

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS method_validation_url  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS method_correlation_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS manual_url             TEXT DEFAULT NULL;
