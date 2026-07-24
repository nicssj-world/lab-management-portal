-- Department-level org role for the group org chart (ผังองค์กรกลุ่มงาน).
-- null = ลูกน้อง (default). group_lead/group_deputy = ระดับกลุ่มงาน (บนสุด),
-- section_head = หัวหน้างานของ dept นั้น. หัวหน้า/ลูกน้องอิงจาก profiles.dept.

alter table profiles add column if not exists dept_role text
  check (dept_role in ('group_lead', 'group_deputy', 'section_head'));

create index if not exists profiles_dept_role on profiles(dept_role) where dept_role is not null;
