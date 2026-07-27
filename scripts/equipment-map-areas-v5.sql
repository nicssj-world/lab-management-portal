-- Equipment map areas v5 — restore the separate room at the north-east corner
-- of the microbiology block. Safe to run after equipment-map-areas-v4.sql and safe to re-run.

begin;

insert into equipment_areas (code, kind, parent_code, name_th, sort_order, has_geometry, is_active)
values ('room-microbiology-ne', 'room', null, 'ห้องมุมขวาบนจุลชีววิทยา', 10, true, true)
on conflict (code) do update
set kind = excluded.kind,
    parent_code = excluded.parent_code,
    name_th = excluded.name_th,
    sort_order = excluded.sort_order,
    has_geometry = true,
    is_active = true;

commit;

notify pgrst, 'reload schema';
