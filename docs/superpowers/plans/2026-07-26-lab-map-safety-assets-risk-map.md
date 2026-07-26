# แผนพัฒนาทะเบียนอุปกรณ์ จุดรวมพล และแผนที่ความเสี่ยง

วันที่: 26 กรกฎาคม 2569  
สถานะ: ดำเนินการบน `main`

## เป้าหมาย

เชื่อมทะเบียนอุปกรณ์ความปลอดภัย จุดรวมพล การตรวจยืนยันหน้างาน release snapshot และ Risk Map เข้ากับแผนที่ห้องปฏิบัติการเดิม โดยแยก working copy ออกจากข้อมูลที่เผยแพร่แล้วอย่างชัดเจน

## ขอบเขตที่ดำเนินการ

- หน้า `/staff/lab-map/safety-assets` มีแท็บอุปกรณ์ จุดรวมพล และการกำหนด Safety Editor
- อุปกรณ์รองรับ 9 ประเภท พิกัดบน viewBox ห้อง สถานะตำแหน่ง วงจรชีวิต และประวัติการตรวจแบบ immutable
- จุดรวมพลแก้ชื่อ จุดสังเกต GPS และทางออก 3A/3B/3C ได้ พร้อมประวัติยืนยันและภาพสถานที่จริง
- ใช้ private R2 และตรวจ MIME, ขนาดไม่เกิน 10 MB และ magic bytes ก่อน finalize
- Admin/Manager retire และจัดการ release; Safety Editor แก้ไขและยืนยันหน้างาน แต่เผยแพร่ไม่ได้
- draft release เก็บ `asset_snapshot` และ `assembly_point_snapshot` พร้อม manifest hash
- แผนที่ทั่วไปและเอกสารพิมพ์อ่านเฉพาะ published snapshot; หน้าแก้ไขอ่าน working copy
- หน้า `/staff/risk/map` แยกชั้นอุบัติการณ์และทะเบียนความเสี่ยง โดยส่งเฉพาะข้อมูลสรุประดับพื้นที่
- เพิ่ม `space_code` แบบ optional ใน IOR และทะเบียนความเสี่ยง พร้อม deep link กลับไปรายการที่กรองตรงกัน

## กติกาการเผยแพร่

ห้าม publish เมื่อยังมีอุปกรณ์ active ที่ไม่ยืนยัน จุดรวมพล active ขาด GPS/รูป/ทางออก ข้อมูล working copy เปลี่ยนหลังสร้าง draft หรือ reviewer/approver ไม่ครบและไม่แยกบุคคลกัน ผลตรวจที่เกิดหลัง publish แสดงเป็นคำเตือนสดโดยไม่เปลี่ยนตำแหน่งใน snapshot

## Rollout

1. รัน `scripts/lab-map-safety-module.sql` ใน staging และตรวจว่า migration รันซ้ำได้
2. รัน `npx tsx scripts/backfill-lab-map-release-snapshots.ts` เพื่อตรวจจำนวน release เดิม แล้วรันซ้ำพร้อม `--apply` เมื่อยืนยันแล้ว
3. ตั้งค่า private R2 เดิมและทดสอบ JPEG/PNG/WebP รวมไฟล์ปลอมและไฟล์เกินขนาด
4. Admin แต่งตั้ง Safety Editor และเดินตรวจถังดับเพลิงจุด 4 ก่อนจนครบ 11 จุด
5. ยืนยันจุดรวมพลด้วย GPS รูปสถานที่จริง และทางออกอย่างน้อยหนึ่งจุด
6. สร้าง draft ใหม่ ตรวจ reviewer/approver แล้ว publish
7. ตรวจ responsive, keyboard, screen reader, reduced motion และ production logs

## Verification

ใช้ `npm run test:lab-map-safety`, ชุดทดสอบ lab map เดิม, risk domain tests, `npx tsc --noEmit` และ `npm run build` เป็น release gate
