-- Equipment map (แผนผังเครื่องมือ) — PM/CAL walking-tour planning.
-- Geometry (room/zone shapes) stays in Git at lib/equipment-map/manifest.ts, same pattern as
-- lab_map_spaces/lab_map_zones: this schema stores stable codes, editable names, and per-item state.
-- Run via Supabase Dashboard -> SQL Editor. Safe to re-run.

-- (1) พื้นที่ (ห้อง/โซน) — code ต้องตรงกับ EQUIPMENT_AREAS ใน lib/equipment-map/manifest.ts เสมอ
create table if not exists equipment_areas (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  kind text not null check (kind in ('room', 'zone')),
  parent_code text references equipment_areas(code) on update cascade,
  name_th text not null,
  has_geometry boolean not null default true,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  updated_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_areas_parent_rule
    check ((kind = 'zone' and parent_code is not null) or (kind = 'room' and parent_code is null))
);

create index if not exists equipment_areas_parent_code_idx on equipment_areas(parent_code);

alter table equipment_areas enable row level security;
revoke all on equipment_areas from anon, authenticated;

-- (2) ตำแหน่งบนแผนที่ — เก็บบน equipment โดยตรง เพื่อให้ "ยังไม่กำหนดตำแหน่ง" เป็น where map_x is null
alter table equipment
  add column if not exists area_code text references equipment_areas(code) on update cascade on delete set null,
  add column if not exists map_x numeric(8, 2) check (map_x >= 0 and map_x <= 1477),
  add column if not exists map_y numeric(8, 2) check (map_y >= 0 and map_y <= 892),
  add column if not exists map_rotation smallint not null default 0 check (map_rotation in (0, 90, 180, 270)),
  add column if not exists position_set_by uuid references profiles(id),
  add column if not exists position_set_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'equipment_map_point_pair'
  ) then
    alter table equipment
      add constraint equipment_map_point_pair check (num_nonnulls(map_x, map_y) <> 1);
  end if;
end $$;

create index if not exists equipment_area_code_idx on equipment(area_code);

-- (3) รอบสำรวจ — เปิดรอบใหม่ = ทุกเครื่องมือกลับเป็น "ยังไม่สำรวจ" อัตโนมัติ (ไม่มี record ในรอบใหม่)
create table if not exists equipment_survey_rounds (
  id uuid primary key default gen_random_uuid(),
  name_th text not null,
  note text,
  started_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists equipment_survey_one_open_idx
  on equipment_survey_rounds ((closed_at is null))
  where closed_at is null;

alter table equipment_survey_rounds enable row level security;
revoke all on equipment_survey_rounds from anon, authenticated;

create table if not exists equipment_survey_records (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references equipment_survey_rounds(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  surveyed_at timestamptz not null default now(),
  surveyed_by uuid references profiles(id),
  condition text check (condition in ('ok', 'ชำรุด', 'ไม่พบ', 'ย้าย')),
  note text,
  unique (round_id, equipment_id)
);

create index if not exists equipment_survey_records_round_idx on equipment_survey_records(round_id);
create index if not exists equipment_survey_records_equipment_idx on equipment_survey_records(equipment_id);

alter table equipment_survey_records enable row level security;
revoke all on equipment_survey_records from anon, authenticated;

-- (4) seed พื้นที่จาก EQUIPMENT_AREAS (lib/equipment-map/manifest.ts) — on conflict do nothing
-- เพื่อไม่เขียนทับชื่อที่ผู้ใช้แก้ไว้เองตอนรันซ้ำ ลำดับแถวเรียงห้องแม่ก่อนโซนลูกเสมอ (FK ต้องมีห้องแม่ก่อน)
insert into equipment_areas (code, kind, parent_code, name_th, sort_order)
values
  ('room-restroom-northwest-1', 'room', null, 'ห้องน้ำ', 1),
  ('room-shower-northwest', 'room', null, 'ห้องอาบน้ำ', 2),
  ('room-restroom-northwest-2', 'room', null, 'ห้องน้ำ', 3),
  ('room-staff-rest-room', 'room', null, 'ห้องพักเวรเจ้าหน้าที่', 4),
  ('room-bsl2-enhance', 'room', null, 'BSL2 Enhance', 5),
  ('room-restroom-northeast', 'room', null, 'ห้องน้ำ', 6),
  ('room-pcr-room', 'room', null, 'ห้อง PCR', 7),
  ('room-fungus-room', 'room', null, 'ห้องเชื้อรา', 8),
  ('room-ppe-zone', 'room', null, 'โซน PPE', 9),
  ('room-chemical-prep', 'room', null, 'ห้องเตรียมสารเคมี', 10),
  ('room-electrical-control', 'room', null, 'ห้องควบคุมไฟฟ้า', 11),
  ('room-computer-control', 'room', null, 'ห้องควบคุมระบบคอมพิวเตอร์', 12),
  ('room-meeting-room', 'room', null, 'ห้องประชุม', 13),
  ('room-group-head-office', 'room', null, 'ห้องหัวหน้ากลุ่มงานเทคนิคการแพทย์', 14),
  ('room-group-head-restroom', 'room', null, 'ห้องน้ำ', 15),
  ('room-south-restroom-2', 'room', null, 'ห้องน้ำ', 16),
  ('room-south-restroom-3', 'room', null, 'ห้องน้ำ', 17),
  ('room-lift-3', 'room', null, 'ลิฟท์ 3', 18),
  ('room-lift-4', 'room', null, 'ลิฟท์ 4', 19),
  ('room-locker-room', 'room', null, 'ห้อง Locker จนท.', 20),
  ('room-microbiology-staff-room', 'room', null, 'ห้องพัก จนท. งานจุลชีววิทยา', 21),
  ('room-material-store', 'room', null, 'คลังวัสดุ', 22),
  ('room-blood-donation-room', 'room', null, 'ห้องรับบริจาคเลือด งานคลังเลือด', 23),
  ('room-donor-snack-room', 'room', null, 'ห้องอาหารว่างสำหรับผู้บริจาคเลือด', 24),
  ('room-donor-restroom-1', 'room', null, 'ห้องน้ำ', 25),
  ('room-donor-restroom-2', 'room', null, 'ห้องน้ำ', 26),
  ('room-office', 'room', null, 'สำนักงานกลุ่มงานเทคนิคการแพทย์', 27),
  ('room-stair-room', 'room', null, 'ห้องบันได', 28),
  ('room-lift-2', 'room', null, 'ลิฟท์ 2', 29),
  ('room-lift-1', 'room', null, 'ลิฟท์ 1', 30),
  ('room-staff-waiting-area', 'room', null, 'บริเวณที่พักเจ้าหน้าที่', 31),
  ('room-supplies-equipment-store', 'room', null, 'ห้องเก็บพัสดุและอุปกรณ์', 32),
  ('room-central-lab', 'room', null, 'ห้องปฏิบัติการกลาง (Central Lab)', 33),
  ('zone-central-chem-immuno', 'zone', 'room-central-lab', 'เคมีคลินิก + ภูมิคุ้มกัน', 34),
  ('zone-central-microscopy', 'zone', 'room-central-lab', 'จุลทรรศนศาสตร์', 35),
  ('zone-central-hematology', 'zone', 'room-central-lab', 'โลหิตวิทยา', 36),
  ('zone-microbiology', 'room', null, 'จุลชีววิทยา', 37),
  ('zone-equipment-wash', 'room', null, 'ห้องล้าง', 38),
  ('zone-molecular-genomics', 'room', null, 'อณูชีววิทยา', 39),
  ('zone-clinical-immunology', 'room', null, 'ภูมิคุ้มกัน', 40),
  ('zone-cold-storage', 'room', null, 'ตู้เย็น (คลังแช่เย็น)', 41),
  ('zone-special-testing', 'room', null, 'ตรวจพิเศษและตรวจต่อ', 42),
  ('zone-material-reagent-store', 'room', null, 'คลังน้ำยา', 43),
  ('zone-blood-bank', 'room', null, 'คลังเลือด', 44)
on conflict (code) do nothing;

notify pgrst, 'reload schema';
