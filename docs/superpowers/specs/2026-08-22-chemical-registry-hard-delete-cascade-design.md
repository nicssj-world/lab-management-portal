# Chemical Registry Hard-Delete Cascade Design

**Date:** 2026-08-22

## Goal

ให้ผู้ดูแลลบรายการสารเคมีจากหน้าทะเบียนสารเคมีได้จริง โดยรายการ SDS ที่เป็นของรายการนั้นถูกลบออกจากหน้าทะเบียน, SDS ห้องสารเคมี และ SDS แยกตามงานในคำสั่งเดียวกัน

ผู้ใช้ยืนยันแล้วว่าไม่ต้องเก็บหลักฐานคุณภาพของ SDS ที่ถูกลบ จึงใช้ hard delete สำหรับข้อมูลที่ไม่ถูกอ้างอิงที่อื่น

## Chosen behavior

ปุ่ม `X` ในหน้าทะเบียนเป็นจุดเริ่มต้นของ workflow ทั้งหมด:

1. ระบบคำนวณผลกระทบของ holding ที่เลือกก่อนลบ
2. ถ้า SDS version เดียวกันถูกใช้กับ holding อื่น ระบบลบเฉพาะ publication/link ของ holding เป้าหมาย และแสดง SDS ที่จะเก็บไว้ให้ผู้ใช้อื่น
3. ระบบแสดงรายการทะเบียน, SDS, publication และไฟล์ที่จะลบ แล้วให้ผู้ใช้ยืนยันการลบถาวรได้ แม้จะมี SDS ที่ใช้ร่วมกัน
4. หลังยืนยัน server เรียก database function เดียวเพื่อทำงานทั้งหมดใน transaction เดียว
5. เมื่อสำเร็จ หน้าทะเบียนและหน้า SDS ทั้งสองประเภทจะไม่แสดงข้อมูลดังกล่าวอีก

การเก็บหรือลบไฟล์ PDF ไม่ใช่ตัวเลือกของผู้ใช้ ระบบตรวจ reference อัตโนมัติ:

- ถ้า `chemical_sds_versions.file_id` หรือ `chemical_department_sds.file_id` ยังอ้างถึงไฟล์เดียวกันจากข้อมูลอื่น ให้เก็บไฟล์ไว้และลบเฉพาะ metadata ที่เป็นของรายการเป้าหมาย
- ถ้าไม่มี reference อื่น ให้ลบแถวไฟล์และลบ object จาก R2 หลัง transaction สำเร็จ

## Shared-reference handling

ต้องตรวจ dependency จากทั้งความสัมพันธ์ตรงและความสัมพันธ์ผ่าน link:

- `chemical_sds_versions.source_holding_id`
- `chemical_sds_publications.source_holding_id`
- `chemical_sds_publications.sds_version_id`
- `chemical_department_chemical_links.holding_id`
- `chemical_department_chemical_links.sds_version_id`
- `chemical_department_sds.file_id`

หาก SDS version เดียวกันมี publication หรือ department link ของ holding อื่น ระบบห้ามลบ SDS version นั้น แต่ไม่ห้ามลบ holding เป้าหมาย ให้ลบเฉพาะ publication/link ของ holding เป้าหมาย และเก็บ version/file ที่รายการอื่นยังใช้อยู่

ถ้า version ที่จะเก็บไว้มี `source_holding_id` เป็น holding เป้าหมาย ให้ตั้ง `source_holding_id` เป็น `NULL` และเปลี่ยน `workflow_origin` เป็น `legacy` ก่อนลบ holding เพื่อไม่ให้ foreign key ขัดขวางการใช้งานของรายการอื่น

การตรวจนี้ต้องครอบคลุมกรณีที่ binary PDF เดียวกันถูกใช้หลาย SDS version ด้วย แต่กรณีไฟล์ซ้ำอย่างเดียวไม่ถือเป็น shared SDS dependency และไม่ต้องบล็อกการลบ

## Database transaction

เพิ่ม RPC แบบ service-role-only สำหรับการลบ cascade โดยล็อก holding และ dependency rows ก่อนตรวจซ้ำใน transaction เดียว เพื่อป้องกันการเปลี่ยนแปลงระหว่าง preflight กับการลบจริง

ลำดับการลบ:

1. ลบ `chemical_sds_publications` ที่เป็นของ holding
2. ลบ `chemical_department_chemical_links` ที่เป็นของ holding
3. ถอด `source_holding_id` ของ version ที่เป็นของ holding เป้าหมายแต่ยังมี reference อื่น
4. ลบ `chemical_sds_hazards` และ `chemical_sds_versions` ที่เป็นของ holding และไม่มี reference อื่น
5. ลบ `chemical_department_sds` ที่เป็นไฟล์ของ link เป้าหมายและไม่มี link/reference อื่น
6. ลบ `chemical_inventory_holdings`
7. คืนรายการไฟล์ที่ไม่มี reference เพื่อให้ server ลบจาก R2 หลัง commit

ห้ามลบ `chemical_products` หรือ `chemical_unit_products` โดยอัตโนมัติ เพราะ product master อาจถูกใช้กับ holding อื่น การลบ product เป็นงานแยกต่างหากนอก scope นี้

การคำนวณ shared reference และการลบต้องอยู่ใน transaction เดียวกัน เพื่อให้รายการอื่นไม่เสีย SDS ที่ยังใช้งานอยู่ และห้ามเกิด partial delete ของ holding เป้าหมาย

## API and UI

เพิ่ม preflight endpoint หรือ response shape สำหรับปุ่มลบ เพื่อให้ UI แสดง:

- รายการ SDS ที่จะถูกลบ
- publication ปลายทาง: ห้องสารเคมี/งาน
- ไฟล์ที่เก็บไว้เพราะมี reference อื่น
- รายการ holding อื่นที่ยังใช้ SDS เดียวกัน

confirmation ต้องระบุชัดว่าเป็นการลบถาวรและย้อนคืนไม่ได้ และบอกว่า SDS ที่รายการอื่นยังใช้อยู่จะถูกเก็บไว้ หลังสำเร็จให้ refresh registry และ SDS views

สิทธิ์ยังใช้ `requireChemicalCustodian`/`canManageChemicals` ตามขอบเขตหน่วยงานเดิม และ frontend ห้ามเขียนตาราง Supabase โดยตรง

## Storage cleanup

การลบ database rows และการลบ R2 object ไม่สามารถเป็น transaction เดียวกันได้ จึงให้ RPC คืน `file_id`/storage key ที่ orphan แล้วให้ server ลบหลัง commit หาก R2 ล้มเหลว ให้บันทึก cleanup failure สำหรับ `chemical-safety:cleanup-sds` โดยไม่ทำให้ข้อมูลฐานข้อมูลที่ลบสำเร็จถูกสร้างกลับ

ต้องใช้ reference check ล่าสุดก่อนลบ object และไม่ลบไฟล์ที่ถูกอ้างโดย `chemical_sds_versions` หรือ `chemical_department_sds` อื่น

## Error handling

- `holding_not_found`: 404
- stale/preflight mismatch: ให้โหลดผลกระทบใหม่หรือคืน error มาตรฐานโดยไม่เปิดเผยรายละเอียดฐานข้อมูล
- storage cleanup failure: ไม่ rollback database แต่แจ้งว่า registry ลบแล้วและมีไฟล์รอ cleanup
- error อื่น: ใช้ error mapping มาตรฐานโดยไม่เปิดเผยรายละเอียดฐานข้อมูล

## Tests

เพิ่ม regression/contract tests สำหรับ:

- ลบ holding ที่มี SDS room และ publication ได้ครบใน transaction เดียว
- ลบ holding ที่มี department SDS link ได้ครบทั้ง link และไฟล์ metadata
- shared SDS version กับ holding อื่นทำให้ลบเฉพาะ target publication/link และเก็บ version/file ที่ยังถูกอ้างอิง
- binary file เดียวกันถูกใช้หลาย version แล้วลบ metadata เป้าหมายได้ แต่ไฟล์ยังอยู่
- binary file ไม่มี reference อื่นถูกส่งเข้า storage cleanup
- product master และ holding อื่นไม่ถูกลบ
- UI แสดง impact, shared dependency และ irreversible confirmation ถูกต้อง

ตรวจด้วย test ชุด chemical safety, TypeScript, build และ migration contract tests

## Out of scope

- ลบ product master อัตโนมัติ
- ย้าย SDS ไปยัง holding อื่นโดยอัตโนมัติ
- ให้ผู้ใช้เลือกว่าจะเก็บหรือลบ binary file
- เปลี่ยนความหมายของปุ่ม Inactive ซึ่งเป็น lifecycle ของ product
