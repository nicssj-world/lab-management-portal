# ผูกไฟล์ SDS แยกตามงานกับรายการทะเบียนเดิม

วันที่: 2026-08-09

## เป้าหมาย

เพิ่ม workflow สำหรับรายการ SDS ที่ระบบระบุว่า `registered` หรือ “พบในทะเบียน · ยังไม่ผูกไฟล์” ให้ผู้มีสิทธิ์ยืนยันการผูกไฟล์กับรายการถือครองเดิมได้ โดยต้องไม่สร้าง `chemical_products`, `chemical_unit_products` หรือ `chemical_inventory_holdings` ซ้ำ

## แนวทางที่เลือก

ใช้ปุ่ม “ผูกไฟล์กับทะเบียน” และ endpoint เฉพาะสำหรับการผูกกับ holding เดิม การเปลี่ยนแปลงฐานข้อมูลทั้งหมดเกิดใน PostgreSQL function เดียวเพื่อให้การสร้าง/นำ SDS version กลับมาใช้และการสร้าง link เป็น atomic

แนวทางนี้ดีกว่าการใช้ workflow “เพิ่มเข้าทะเบียนสารเคมี” เดิม เพราะ workflow เดิมสร้าง holding ใหม่เมื่ออนุมัติ และปลอดภัยกว่าการผูกทุกชื่อที่คล้ายกันโดยอัตโนมัติ

## ประสบการณ์ผู้ใช้

- ปุ่ม “ผูกไฟล์กับทะเบียน” แสดงเฉพาะรายการสถานะ `registered` และผู้ใช้ที่มีสิทธิ์ดูแลทะเบียนของหน่วยงานนั้น
- เมื่อกดปุ่ม จะเปิด modal แสดงชื่อไฟล์และรายการถือครองที่ระบบจับคู่ได้
- ถ้ามี candidate เดียว ระบบเลือกไว้ให้ ผู้ใช้กดยืนยันได้ทันที
- ถ้ามีหลาย candidate ผู้ใช้ต้องเลือกหนึ่งรายการก่อนยืนยัน ระบบจะไม่เลือกแบบสุ่ม
- เมื่อสำเร็จ สถานะเปลี่ยนเป็น “อยู่ในทะเบียน · ผูกไฟล์แล้ว” และปุ่มแทนที่/ลบเปลี่ยนเป็น disabled ตามกฎเดิม
- เมื่อ holding นั้นผูกกับ SDS งานอื่นอยู่แล้ว ระบบปฏิเสธพร้อมข้อความที่เข้าใจได้ และไม่ย้าย link โดยอัตโนมัติ

## ข้อมูลที่ส่งถึง UI

`DepartmentSdsRegistryLinkDTO` เพิ่ม `candidates` ซึ่งแต่ละรายการประกอบด้วย:

- `productId`
- `productName`
- `holdingId`
- `lotNumber`
- `packageValue`
- `packageUnit`
- `currentContainerCount`
- `availableToLink` เพื่อบอกว่า holding ยังไม่ถูก link กับ SDS งานอื่น

สถานะ `registered` ใช้ candidates ทั้งหมดที่จับคู่ชื่อได้ภายในหน่วยงานเดียวกัน ส่วนสถานะ `linked` ยังคงมาจาก `chemical_department_chemical_links` ซึ่งเป็นข้อมูลยืนยันโดยตรง

## API และสิทธิ์

เพิ่ม `POST /api/admin/chemical-safety/department-sds/[code]/link-existing` รับ `{ holdingId }`

Endpoint ต้อง:

1. ตรวจ body ด้วย UUID schema
2. โหลด SDS งานและหน่วยงานจากฐานข้อมูล
3. ตรวจสิทธิ์ด้วย `requireChemicalCustodian(unitId)`
4. เรียก RPC ด้วย service role โดยส่ง `departmentSdsId`, `holdingId` และ `actorId`
5. แปลงข้อผิดพลาดที่คาดไว้เป็น HTTP 404/409/422 และข้อความภาษาไทย

Frontend ไม่มีสิทธิ์เขียนตาราง link หรือ SDS version โดยตรง

## PostgreSQL function

เพิ่ม migration ผ่าน Supabase CLI สำหรับ function `link_department_sds_to_existing_holding(uuid, uuid, uuid)` แบบ `SECURITY INVOKER` และอนุญาต execute เฉพาะ `service_role`

Function ทำงานใน transaction เดียวและตรวจว่า:

- SDS งานมีไฟล์อ้างอิงและยังไม่ถูก link
- department map ไปยัง chemical unit ที่ active ได้
- holding เป็น `storage_scope = 'department'` และอยู่ใน unit เดียวกับ SDS งาน
- holding ยังไม่ถูก link กับ SDS งานอื่น
- product และ unit-product ยัง active

จากนั้น function จะนำ `chemical_sds_versions` ที่มี `product_id + file_id` เดิมกลับมาใช้ หรือสร้างฉบับ `draft` ใหม่ แล้ว insert `chemical_department_chemical_links` และ `audit_log` ก่อนคืนข้อมูล link

Function ต้อง `REVOKE ALL ... FROM PUBLIC, anon, authenticated` และ `GRANT EXECUTE ... TO service_role`

## การจัดการข้อผิดพลาด

- candidate ไม่ตรงหน่วยงาน: ปฏิเสธ ไม่สร้างข้อมูลใด ๆ
- SDS หรือ holding ไม่พบ: 404
- SDS ถูก link แล้วหรือ holding ถูกใช้แล้ว: 409
- SDS ไม่มีไฟล์, unit ไม่ active หรือ unit-product ไม่ active: 422
- ความผิดพลาดอื่น: ใช้ error handler มาตรฐานและไม่เปิดเผยรายละเอียดฐานข้อมูล

## การทดสอบ

- Unit test สำหรับตัวจับคู่ที่คืน candidates ครบและไม่เลือก candidate กำกวมเอง
- Contract test สำหรับ migration: atomic function, same-unit/storage-scope guards, revoke/grant และไม่มี insert holding/product
- Route contract test: UUID validation, custodian guard และเรียก RPC เท่านั้น
- UI contract test: ปุ่มแสดงเฉพาะ `registered`, modal บังคับเลือก candidate และเรียก endpoint ใหม่
- รัน `npm run test:chemical-safety`, `npx tsc --noEmit`, `git diff --check` และ `npm run build`

## นอกขอบเขต

- ไม่ย้ายหรือยกเลิก link ที่มีอยู่
- ไม่อนุมัติหรือเผยแพร่ SDS version อัตโนมัติ
- ไม่ผูกชื่อที่ระบบไม่พบ candidate
- ไม่แก้ข้อมูลปริมาณ ล็อต หรือวันหมดอายุของ holding เดิม
