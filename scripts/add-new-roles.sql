-- Migration: Add Document Controller and Medical Science Technician roles
-- Run via: Supabase Dashboard → SQL Editor

-- Drop old constraint
alter table profiles drop constraint if exists profiles_role_check;

-- Add updated constraint with all 6 roles
alter table profiles add constraint profiles_role_check
  check (role in (
    'Admin',
    'Manager',
    'Document Controller',
    'Medical Technologist',
    'Medical Science Technician',
    'Assistant'
  ));
