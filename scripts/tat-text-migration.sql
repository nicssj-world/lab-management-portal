-- Migration: change tat_minutes and urgent_tat_minutes from integer to text
-- Run via Supabase Dashboard → SQL Editor

ALTER TABLE tests
  ALTER COLUMN tat_minutes TYPE text USING tat_minutes::text,
  ALTER COLUMN urgent_tat_minutes TYPE text USING urgent_tat_minutes::text;
