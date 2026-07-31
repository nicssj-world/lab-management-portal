-- Equipment map areas v9 — align legacy area display names with the verified equipment plan.
-- Safe to run after v8 and safe to re-run. Stable codes are intentionally retained
-- so existing equipment.area_code links and map pins remain intact.

begin;

update equipment_areas
set name_th = case code
  when 'zone-equipment-wash' then 'ห้องล้าง'
  when 'room-fume-hood' then 'ห้องสารเคมี'
  when 'room-fume-hood-side' then 'ไฟฟ้า'
  else name_th
end
where code in ('zone-equipment-wash', 'room-fume-hood', 'room-fume-hood-side');

commit;

notify pgrst, 'reload schema';
