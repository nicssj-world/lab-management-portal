-- Include the Blood Bank category-6 export in BLB IT verification sampling.
insert into public.it_verification_section_map (
  source_lab_section,
  department_id,
  is_active
)
select
  'ธนาคารเลือดหมวด 6',
  d.id,
  true
from public.departments d
where d.code = 'BLB'
on conflict (source_lab_section) do update
set
  department_id = excluded.department_id,
  is_active = true,
  updated_at = now();
