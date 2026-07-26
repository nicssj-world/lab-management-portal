# แผงจัดการฉบับแผนที่ควบคุม (Lab Map Release Panel)

## เป้าหมาย

หน้า "ส่งออกแผนที่ควบคุม" (`/staff/lab-map/print`) แสดงปุ่ม "ส่งออกฉบับใช้งานจริง PDF" เป็นสีเทาค้างตลอด เพราะไม่เคยมีฉบับแผนที่ไหนถูกสร้าง/ทบทวน/อนุมัติ/เผยแพร่ได้เลย — API หลังบ้าน (`/api/admin/lab-map/releases*`) มีครบอยู่แล้ว แต่ไม่มีหน้าจอไหนเรียกใช้ เพิ่มแผงจัดการฉบับแผนที่เข้าไปในหน้าเดิมโดยไม่สร้าง route ใหม่ ให้ Admin/Manager สร้างฉบับร่าง ระบุผู้ทบทวน/ผู้อนุมัติ และเผยแพร่ได้จากหน้านี้โดยตรง

## ตำแหน่งและสิทธิ์

- คอมโพเนนต์ใหม่: `components/lab-map/LabMapReleasePanel.tsx` (client component แยกจาก `LabMapExportClient` — `LabMapExportClient` คงหน้าที่เดิมคือแสดงผล/ส่งออกเท่านั้น ไม่ปนกับการจัดการวงจรชีวิตของฉบับ)
- เรนเดอร์ใน `app/(protected)/staff/lab-map/print/page.tsx` เหนือ `LabMapExportClient`
- ใช้ `canManageMapReleases(actor)` (เดิมมีอยู่แล้วใน `lib/lab-map/release-server.ts`, เช็ก Admin/Manager) เป็นเงื่อนไขทั้งการ fetch รายชื่อบุคลากรและการเรนเดอร์แผง — ผู้ใช้ role อื่นเห็นหน้าเดิมทุกประการ ไม่มีการเปลี่ยน permission matrix หรือเพิ่ม resource key ใหม่ เพราะ API เดิมก็ hardcode เช็กนี้อยู่แล้ว
- ดึงรายชื่อบุคลากร (`id, name, role`) ด้วย `supabaseAdmin.from('profiles').select(...)` เฉพาะตอน `canManageMapReleases(actor)` เป็นจริง — รูปแบบเดียวกับ `app/(protected)/staff/lab-map/safety-assets/page.tsx`

## สถานะของแผง

`print/page.tsx` fetch ฉบับปัจจุบันอยู่แล้ว (published หรือ draft ล่าสุด, หรือ synthetic fallback ที่ไม่มี `id` ถ้าไม่มีทั้งคู่) ส่ง `release` + `staff` + `canManageReleases` เป็น prop ให้ `LabMapReleasePanel` ตัดสินสถานะจาก `release.id` และ `release.status`:

1. **ไม่มีฉบับจริง** (`release.id` เป็น undefined — fallback เดิม): ฟอร์มสร้างฉบับร่าง — รหัสเวอร์ชัน (prefill ข้อเสนอ เช่น `F3-2026.07.27-01` แก้ไขได้), วันที่มีผล, หมายเหตุ → ปุ่ม "สร้างฉบับร่าง" เรียก `POST /api/admin/lab-map/releases`
2. **มีฉบับร่าง** (`status === 'draft'`): Select ผู้ทบทวน / ผู้อนุมัติ (จากรายชื่อบุคลากร, ใช้ `components/ui/Select`), วันที่มีผล, หมายเหตุ → ปุ่ม "บันทึก" เรียก `PATCH /api/admin/lab-map/releases/[id]`; ปุ่มแยก "เผยแพร่" เรียก `POST /api/admin/lab-map/releases/[id]/publish` — ถ้าได้ 422 กลับมาพร้อม `blockers[]` ให้แสดงเป็นรายการข้อความไทยตรงจาก `validatePublishableRelease` (เช่น "ยังไม่ได้ยืนยันตำแหน่งอุปกรณ์ความปลอดภัยหน้างาน") ใต้ปุ่มแทนการ throw เฉยๆ
3. **เผยแพร่แล้ว** (`status === 'published'`): แสดงสรุปอ่านอย่างเดียว (รหัสเวอร์ชัน, วันที่มีผล, ชื่อผู้ทบทวน/ผู้อนุมัติ, วันที่เผยแพร่) + ปุ่ม "สร้างฉบับร่างใหม่" (เรียก POST releases อีกครั้งเพื่อเริ่มรอบถัดไป)

หลังทำสำเร็จทุก action เรียก `router.refresh()` เพื่อให้ Server Component ดึงฉบับล่าสุดใหม่ (รวมถึง `LabMapExportClient` ที่จะเห็น `dto.official = true` ทันทีที่เผยแพร่สำเร็จ)

ใช้ toast hook มาตรฐานของโปรเจกต์ (`useToast`, มุมล่างขวา, auto-dismiss 3.5s) แจ้งผลสำเร็จ/ผิดพลาดของทุก action

## แก้จุดบกพร่องที่ซ่อนอยู่: ชื่อผู้ทบทวน/ผู้อนุมัติในแผ่นพิมพ์

`MapReleaseDTO.reviewerName` / `approverName` ไม่เคยถูกเติมค่าที่ไหนเลยในโค้ดปัจจุบัน — `LabMapPrintSheet.tsx` footer จึง fallback ไปแสดง UUID ดิบ (`dto.release.reviewedBy`) ถ้าไม่มีชื่อ ไม่มีใครเจอมาก่อนเพราะไม่เคยมีฉบับไหนถูกตั้งผู้ทบทวน/อนุมัติได้จริง เมื่อฟีเจอร์นี้ใช้งานได้ จุดนี้จะโผล่ทันที

แก้ใน `print/page.tsx`: หลังได้ `release` แล้ว ถ้ามี `reviewedBy`/`approvedBy` ให้ query ชื่อทั้งสองจาก `profiles` (`supabaseAdmin.from('profiles').select('id, name').in('id', [...])`) แล้วประกอบเป็น `release.reviewerName` / `release.approverName` ก่อนส่งต่อให้ `buildMapPrintDTO` — ไม่ต้องแก้ `mapReleaseRow` (ใช้ร่วมกับ API routes อื่นที่ไม่ต้องการชื่อ)

## API ที่ใช้ (ไม่มีการเพิ่ม/แก้ route)

ใช้ของเดิมทั้งหมด ทุก route เช็ก `getActor()` + `canManageMapReleases()` และ validate ที่ server อยู่แล้ว:
- `POST /api/admin/lab-map/releases` — สร้างฉบับร่าง
- `PATCH /api/admin/lab-map/releases/[id]` — แก้ไขฉบับร่าง (บล็อกถ้า status ไม่ใช่ draft)
- `POST /api/admin/lab-map/releases/[id]/publish` — เผยแพร่ (คืน `blockers[]` เมื่อ 422)

## การทดสอบ

- `npx tsc --noEmit`
- Contract test ใหม่/แก้ไข (`scripts/lab-map-export-ui.test.ts` หรือไฟล์ใหม่ `scripts/lab-map-release-panel.test.ts`) ยืนยัน: แผงถูกเรนเดอร์เฉพาะเมื่อ `canManageMapReleases`, ปุ่มสร้าง/บันทึก/เผยแพร่เรียก endpoint ที่ถูกต้อง, บล็อกเกอร์จาก 422 ถูกแสดง, `print/page.tsx` เติม `reviewerName`/`approverName` ก่อนส่งเข้า `buildMapPrintDTO`
- ทดสอบมือ: ผู้ใช้ role อื่นที่ไม่ใช่ Admin/Manager เปิดหน้าเดิมแล้วไม่เห็นแผงนี้เลย
