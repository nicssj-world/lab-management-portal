-- Link EQA program tests to an instrument (Analyzer / Analyzer (Rental))
-- Each รายการตรวจ (program-test) can carry a bound piece of equipment.
-- equipment_name_snapshot keeps a readable label even if the equipment row changes/moves.

alter table public.eqa_program_tests
  add column if not exists equipment_id uuid references public.equipment(id),
  add column if not exists equipment_name_snapshot text;

create index if not exists eqa_program_tests_equipment on public.eqa_program_tests(equipment_id);
