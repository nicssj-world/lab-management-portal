-- One-time HN normalization for existing tat_records and phlebotomy_records
-- Strips leading zeros from numeric HNs to match the worker normalizeHn() behavior.
-- Run once via Supabase Dashboard → SQL Editor, then run rejoin_tat.sql to refresh the function.

-- tat_records
UPDATE tat_records
SET hn = COALESCE(NULLIF(ltrim(hn, '0'), ''), '0')
WHERE hn ~ '^\d+$' AND hn LIKE '0%';

-- phlebotomy_records
UPDATE phlebotomy_records
SET hn = COALESCE(NULLIF(ltrim(hn, '0'), ''), '0')
WHERE hn ~ '^\d+$' AND hn LIKE '0%';
