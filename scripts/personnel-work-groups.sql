-- Merged work groups (กลุ่มงานรวม) for the group org chart.
-- Admin/Manager can merge several งาน (profiles.dept values) into one box on the
-- org chart, e.g. "งานเคมีคลินิก" + "งานภูมิคุ้มกันวิทยาคลินิก". Section heads and
-- members are still derived from profiles.dept + dept_role; this table only records
-- which depts are displayed together.

create table if not exists public.personnel_work_groups (
  id         uuid primary key default gen_random_uuid(),
  name       text,                    -- optional custom label; null → join dept names
  depts      text[] not null,         -- the profiles.dept values grouped together
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

-- Accessed via the service-role admin client only (mirrors the rest of the module).
alter table public.personnel_work_groups enable row level security;
