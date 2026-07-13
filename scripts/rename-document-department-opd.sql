-- lib/documents/departments.ts renamed the OPD department to match the canonical
-- name used everywhere else (personnel, risk register, KPI, org chart): "งานบริการผู้ป่วยนอก".
-- Existing documents still carrying the old label won't match the new dropdown/filter
-- list until their stored value is updated too.
UPDATE documents
SET department = 'งานบริการผู้ป่วยนอก'
WHERE department = 'งานชันสูตรผู้ป่วยนอก';
