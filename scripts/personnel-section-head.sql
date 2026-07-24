-- Split "section head" out of dept_role so a person can hold a group-level role
-- (หัวหน้า/รองหัวหน้ากลุ่มงาน) AND still be a หัวหน้างาน of their own งาน at the same time.
--   dept_role       : 'group_lead' | 'group_deputy' | null   (group-level placement)
--   is_section_head : boolean                                 (leads their own dept)

alter table public.profiles add column if not exists is_section_head boolean not null default false;

-- Migrate anyone previously marked section_head via dept_role.
update public.profiles set is_section_head = true where dept_role = 'section_head';
update public.profiles set dept_role = null where dept_role = 'section_head';
