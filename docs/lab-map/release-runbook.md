# Runbook การเผยแพร่แผนที่ห้องปฏิบัติการ

## 1. เตรียมระบบ

1. ตรวจว่าโค้ด Foundation, Visitor Flow, Staff/Personnel และ Print/Release อยู่ใน revision เดียวกัน
2. ใช้ Supabase SQL Editor รันตามลำดับ:
   - `scripts/it-visitor-log.sql`
   - `scripts/it-visitor-self-checkout.sql`
   - `scripts/lab-map-module.sql`
   - `scripts/lab-map-rebuild-v2.sql` (สร้างผังใหม่ทั้งหมด — ปิดใช้งาน stable code เดิมโดยไม่ลบแถว
     และ retire ฉบับที่เผยแพร่ไว้เดิม เพราะ manifest hash เปลี่ยน)
   - `scripts/lab-map-stations-v3.sql` (เพิ่มสถานีจุดสแกนสำหรับแผนหนีไฟตามตำแหน่งจริง — ไม่แก้เรขาคณิต)
3. ตรวจ stable codes ใน `lab_map_spaces`, `lab_map_zones`, `lab_map_access_points` และ `lab_map_stations` เทียบกับ `lib/lab-map/manifest.ts`
4. รัน full gate ที่ระบุใน README หาก gate ใดไม่ผ่านให้หยุด

## 2. สร้างฉบับร่าง

1. สร้าง release ผ่าน `POST /api/admin/lab-map/releases`; server จะคำนวณ manifest hash เอง
2. ระบุวันที่มีผล ผู้ทบทวน ผู้อนุมัติ และหมายเหตุผ่าน `PATCH /api/admin/lab-map/releases/[id]`
3. ผู้ทบทวนและผู้อนุมัติต้องเป็นคนละคน
4. เปิด `/staff/lab-map/print` ตรวจตัวอย่างทุกชนิดและทุกขนาด ฉบับร่างต้องมีลายน้ำ “ร่าง — ห้ามใช้ติดตั้ง”
5. ห้ามใช้ draft preview แทนป้ายฉบับใช้งานจริง

## 3. ตรวจพื้นที่จริง

1. พิมพ์ [แบบตรวจรับชั้น 3](./floor-3-acceptance.md)
2. เดินตรวจ main/alternate preset จากทุก station (จุดติดตั้งป้ายและจุดสแกนทั้ง 6 จุด) โดยเทียบกับ
   ป้ายจริง ไม่คำนวณเส้นทางใหม่ — ชี้ขาดว่า preset ใดเป็น "หลัก" ที่จุดที่ระยะไปแต่ละทางออกใกล้เคียงกัน
3. ตรวจบานประตูที่ล็อคถาวร จุดสแกนทุกจุด แนวกั้นควบคุม โซน PPE ห้องเย็น และโซนคลังวัสดุ
   โดยเฉพาะจุดสแกนของงานอณูชีววิทยาที่ต้องอยู่บนแนวกั้นข้างโซน PPE ใต้ห้องปฏิบัติการกลาง
4. เดินยืนยันตำแหน่งถังดับเพลิงทั้ง 11 จุดและจุดรวมพล ปรับพิกัดใน `lib/lab-map/safety-assets.ts`
   ให้ตรงหน้างานแล้วตั้ง `verified: true` — ห้ามเผยแพร่จนกว่าจะยืนยันครบทุกจุด (release validator บล็อกไว้เอง)
5. ให้ผู้รับผิดชอบควบคุมการติดเชื้อทบทวน classification
6. ตรวจ A3/A4 และ QR ที่ระยะติดตั้งจริง ลงนามและเก็บหลักฐาน

## 4. เผยแพร่และติดตั้ง

1. เรียก `POST /api/admin/lab-map/releases/[id]/publish` หลังลงนามครบ
2. หาก manifest hash เปลี่ยน API จะคืน `409`; สร้าง draft ใหม่และตรวจซ้ำ ห้ามแก้ hash ในฐานข้อมูล
3. Publish RPC จะล็อกตาราง retire ฉบับเดิม และ publish ฉบับใหม่ใน transaction เดียว
4. สร้าง PDF/PNG ฉบับใช้งานจริงจาก `/staff/lab-map/print` และตรวจ version/effective date/reviewer/approver อีกครั้ง
5. เปลี่ยนป้ายจริง เก็บฉบับเก่าตามระบบควบคุมเอกสาร และบันทึกวันที่/จุดติดตั้ง
6. ตรวจ activity log สำหรับ `lab_map.release.publish`

## 5. Rollback และเหตุขัดข้อง

- หากพบข้อมูลผิด ให้หยุดแจก artifact ถอดหรือปิดทับป้ายผิด และกลับไปใช้ป้ายฉบับก่อนหน้าที่ผ่านการอนุมัติ
- คืนโค้ดไปยัง Git revision ของฉบับก่อนหน้า สร้าง release ใหม่ และทำ acceptance ซ้ำ; ห้ามแก้ published row ย้อนหลัง
- เว็บไซต์เป็นข้อมูลเสริม เมื่อไฟฟ้า/เครือข่ายขัดข้องให้ใช้ป้ายฉบับอนุมัติที่ติดตั้งและแผนฉุกเฉินของโรงพยาบาล
- บันทึก incident, revision, ผู้อนุมัติ rollback และผลทดสอบซ้ำใน audit/ระบบเอกสารคุณภาพ
