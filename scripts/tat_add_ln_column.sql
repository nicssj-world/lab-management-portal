-- Add LN (Lab Number / accession number) column to tat_records
-- Run via Supabase Dashboard → SQL Editor

alter table tat_records
  add column if not exists ln text;
