-- Equipment map areas v8 — correct the PM/CAL work-area code mapping after v7.
-- Safe to re-run. Names only; area codes, geometry, parent relationships and pins are untouched.

begin;

update equipment_areas
set name_th = case code
  when 'zone-special-testing' then 'งาน OUTLAB'
  when 'zone-special-testing-upper-1' then 'OUTLAB (โซน 1)'
  when 'zone-special-testing-upper-2' then 'OUTLAB (โซน 2)'
  when 'zone-special-testing-lower' then 'คลังเลือด (crossmatch)'
  when 'zone-special-testing-mid' then 'คลังเลือด (แยกส่วนประกอบ)'
  when 'room-nw-corner' then 'โซนห้องน้ำ ห้องอาบน้ำ'
  when 'room-nw-store' then 'ห้องนอนเจ้าหน้าที่'
  when 'room-centre-upper' then 'ห้องกลางด้านบน 1'
  when 'room-centre-upper-2' then 'ห้องกลางด้านบน 2'
  else name_th
end
where code in (
  'zone-special-testing', 'zone-special-testing-upper-1', 'zone-special-testing-upper-2',
  'zone-special-testing-lower', 'zone-special-testing-mid',
  'room-nw-corner', 'room-nw-store', 'room-centre-upper', 'room-centre-upper-2'
);

commit;

notify pgrst, 'reload schema';
