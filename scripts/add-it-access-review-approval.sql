-- Two-step annual review: add approval fields to it_access_reviews.
-- A review row is first "reviewed" (ยืนยันการทบทวน), then "approved" (อนุมัติ).
-- Run in Supabase Dashboard → SQL Editor (existing environments that already ran it-access-module.sql).

ALTER TABLE it_access_reviews ADD COLUMN IF NOT EXISTS approved_at      timestamptz;
ALTER TABLE it_access_reviews ADD COLUMN IF NOT EXISTS approved_by      uuid REFERENCES profiles(id);
ALTER TABLE it_access_reviews ADD COLUMN IF NOT EXISTS approved_by_name text;
