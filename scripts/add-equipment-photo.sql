-- Add photo_url column to equipment table for equipment photo uploads (stored in R2)
alter table equipment
  add column if not exists photo_url text default null;
