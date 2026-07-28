-- Equipment map areas v7 — operational PM/CAL work-group names.
-- Safe to run after v6 and safe to re-run. This only changes display names;
-- parent_code and geometry remain untouched because they describe the drawing.

begin;

update equipment_areas
set name_th = case code
  when 'zone-molecular-genomics' then 'งานอณูชีววิทยา'
  when 'zone-molecular-1' then 'อณูชีววิทยา'
  when 'zone-molecular-2' then 'Extraction Room'
  when 'zone-molecular-3' then 'Library Room'
  when 'zone-molecular-4' then 'Sequence Room'
  when 'zone-central-chem-immuno' then 'เคมีคลินิก+ภูมิคุ้มกัน'
  when 'zone-special-testing' then 'งาน OUTLAB'
  when 'zone-special-testing-upper-1' then 'OUTLAB (โซน 1)'
  when 'zone-special-testing-upper-2' then 'OUTLAB (โซน 2)'
  when 'zone-special-testing-lower' then 'คลังเลือด (crossmatch)'
  when 'zone-special-testing-mid' then 'คลังเลือด (แยกส่วนประกอบ)'
  when 'room-nw-corner' then 'โซนห้องน้ำ ห้องอาบน้ำ'
  when 'room-nw-store' then 'ห้องนอนเจ้าหน้าที่'
  when 'room-centre-upper' then 'ห้องกลางด้านบน 1'
  when 'room-centre-upper-2' then 'ห้องกลางด้านบน 2'
  when 'room-se-1' then 'ห้องตะวันออกเฉียงใต้ 1'
  when 'room-se-2' then 'ห้องตะวันออกเฉียงใต้ 2'
  when 'room-microbiology' then 'งานจุลชีววิทยา'
  when 'room-microbiology-ne' then 'มุมขวาบนจุลชีววิทยา'
  when 'room-north-corridor-1' then 'โถง 1'
  when 'room-north-corridor-2' then 'โถง 2'
  when 'room-north-corridor-3' then 'โถง 3'
  when 'room-north-small' then 'ห้องน้ำ'
  else name_th
end
where code in (
  'zone-molecular-genomics', 'zone-molecular-1', 'zone-molecular-2', 'zone-molecular-3', 'zone-molecular-4',
  'zone-central-chem-immuno', 'zone-special-testing', 'zone-special-testing-upper-1', 'zone-special-testing-upper-2',
  'zone-special-testing-lower', 'zone-special-testing-mid', 'room-nw-corner', 'room-nw-store', 'room-centre-upper', 'room-centre-upper-2',
  'room-se-1', 'room-se-2', 'room-microbiology', 'room-microbiology-ne',
  'room-north-corridor-1', 'room-north-corridor-2', 'room-north-corridor-3', 'room-north-small'
);

commit;

notify pgrst, 'reload schema';
