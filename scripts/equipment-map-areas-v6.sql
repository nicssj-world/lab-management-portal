-- Equipment map areas v6 — split the centre-upper space into two separate rooms
-- following the vertical wall shown in the reference drawing. Safe to run after
-- equipment-map-areas-v5.sql and safe to re-run.

begin;

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry, is_active)
values
  ('room-centre-upper',   'room', null, 'ห้องกลางด้านบน 1', 13, true, true),
  ('room-centre-upper-2', 'room', null, 'ห้องกลางด้านบน 2', 14, true, true)
on conflict (code) do update
set kind = excluded.kind,
    parent_code = excluded.parent_code,
    name_th = excluded.name_th,
    sort_order = excluded.sort_order,
    has_geometry = true,
    is_active = true;

commit;

notify pgrst, 'reload schema';
