-- EQA / PT และ OUTLAB เข้า Permission Matrix (/staff/admin)
-- Run in Supabase Dashboard > SQL Editor
--
-- เดิมสองโมดูลนี้ไม่มี resource ใน sidebar → ผู้ใช้ที่ล็อกอินทุกคนเห็นและเข้าได้
-- หลังเพิ่มเข้า RESOURCES แล้ว role ที่ไม่มีแถวใน role_permissions จะกลายเป็น 'none' ทันที
-- สคริปต์นี้จึง seed 'view' ให้ทุก role ที่ไม่ใช่ Admin เพื่อคงพฤติกรรมเดิมไว้
-- สิทธิ์แก้ไขยังมาจาก eqa_editors / outlab_editors (หน้า settings ของโมดูล) หรือปรับเป็น
-- edit รายบทบาทได้ที่หน้า /staff/admin

insert into role_permissions (role, resource, granted)
select r.role, res.resource, true
from (values
  ('Manager'),
  ('Medical Technologist'),
  ('Medical Science Technician'),
  ('Assistant')
) as r(role)
cross join (values
  ('EQA / PT:view'),
  ('OUTLAB:view')
) as res(resource)
on conflict (role, resource) do update set granted = excluded.granted;
