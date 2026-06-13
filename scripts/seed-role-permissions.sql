-- Seed role_permissions with defaults matching the permissions matrix
-- Run via Supabase Dashboard → SQL Editor
-- Safe to re-run: deletes existing non-Admin rows first, then inserts defaults

DELETE FROM role_permissions
WHERE role IN ('Manager', 'Medical Technologist', 'Assistant');

INSERT INTO role_permissions (role, resource, granted) VALUES
-- Manager: edit on all except KPI (view) and User Management (none)
('Manager', 'รายการตรวจ:edit',             true),
('Manager', 'เอกสารคุณภาพ:edit',           true),
('Manager', 'ข่าวสาร:edit',                true),
('Manager', 'ความเสี่ยง / Rejection:edit', true),
('Manager', 'สัญญา:edit',                  true),
('Manager', 'Workload:edit',               true),
('Manager', 'KPI:view',                    true),
('Manager', 'TAT (นำเข้า):edit',           true),
('Manager', 'บุคลากร:edit',                true),

-- Medical Technologist: view on most, none on ข่าวสาร and User Management
('Medical Technologist', 'รายการตรวจ:view',             true),
('Medical Technologist', 'เอกสารคุณภาพ:view',           true),
('Medical Technologist', 'ความเสี่ยง / Rejection:view', true),
('Medical Technologist', 'สัญญา:view',                  true),
('Medical Technologist', 'Workload:view',               true),
('Medical Technologist', 'KPI:view',                    true),
('Medical Technologist', 'TAT (นำเข้า):view',           true),
('Medical Technologist', 'บุคลากร:view',                true),

-- Assistant: same as Medical Technologist
('Assistant', 'รายการตรวจ:view',             true),
('Assistant', 'เอกสารคุณภาพ:view',           true),
('Assistant', 'ความเสี่ยง / Rejection:view', true),
('Assistant', 'สัญญา:view',                  true),
('Assistant', 'Workload:view',               true),
('Assistant', 'KPI:view',                    true),
('Assistant', 'TAT (นำเข้า):view',           true),
('Assistant', 'บุคลากร:view',                true);
