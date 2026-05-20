-- Migration: Update roles to new structure
-- Admin -> Admin
-- Manager -> Manager (was staff)
-- Medical Technologist -> Medical Technologist (was editor)
-- Assistant -> Assistant (was viewer)

-- Step 1: Drop old constraint first
alter table profiles drop constraint if exists profiles_role_check;

-- Step 2: Migrate existing data
update profiles set role = 'Admin' where role = 'admin';
update profiles set role = 'Manager' where role = 'staff';
update profiles set role = 'Medical Technologist' where role = 'editor';
update profiles set role = 'Assistant' where role = 'viewer';

-- Step 3: Add new constraint
alter table profiles add constraint profiles_role_check
  check (role in ('Admin','Manager','Medical Technologist','Assistant'));
