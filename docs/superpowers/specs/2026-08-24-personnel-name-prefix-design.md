# เพิ่มคำนำหน้าชื่อในข้อมูลบุคลากรและผู้ใช้งาน

## เป้าหมาย

เพิ่ม dropdown คำนำหน้าชื่อในข้อมูลบุคลากรของ lab management portal โดยใช้ตัวเลือก `นาย`, `น.ส.`, `นาง` และรองรับค่าไม่ระบุสำหรับข้อมูลเดิม คำนำหน้าชื่อจะถูกเก็บแยกจาก `profiles.name` เพื่อไม่ทำให้ชื่อเดิมปะปนกับข้อมูลใหม่

ตัวอย่างการแสดงผล:

- เก็บข้อมูล: `name_prefix = "นาง"`, `name = "สมหญิง ใจดี"`
- แสดงผล: `นางสมหญิง ใจดี` (ไม่มีช่องว่างระหว่างคำนำหน้ากับชื่อ)
- ไม่มีคำนำหน้า: `สมหญิง ใจดี`

## ขอบเขต

1. เพิ่มฟิลด์ `name_prefix` ในตาราง `profiles` และใน TypeScript profile types
2. เพิ่ม dropdown ในโมดัล `แก้ไขประวัติบุคลากร` ของ `/staff/personnel/[id]`
3. เพิ่ม dropdown ใน `UserFormModal` ทั้งโหมด `เพิ่มผู้ใช้งาน` และ `แก้ไขผู้ใช้งาน`
4. ให้ personnel screens และ user-management list แสดงชื่อผ่าน formatter เดียวกัน
5. เพิ่ม validation, API/service mapping, migration และ regression tests ที่เกี่ยวข้อง

## สิ่งที่ไม่ทำ

- ไม่แก้ไขค่าเดิมใน `profiles.name` และไม่เดาคำนำหน้าจากชื่อเดิม
- ไม่บังคับให้บุคลากรเดิมต้องมีคำนำหน้า
- ไม่เพิ่ม master table สำหรับคำนำหน้าชื่อ เพราะรายการเป็นชุดคงที่ 3 ค่า
- ไม่เปลี่ยนรูปแบบไฟล์นำเข้าผู้ใช้แบบ bulk ในงานนี้
- ไม่ปรับการแสดงชื่อในทุกโมดูลของระบบที่อยู่นอก personnel และ user management

## การออกแบบข้อมูล

เพิ่ม migration `supabase/migrations/20260824100000_personnel_name_prefix.sql`:

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name_prefix text;

DO $$ BEGIN
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_name_prefix_check
    CHECK (name_prefix IS NULL OR name_prefix IN ('นาย', 'น.ส.', 'นาง'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

คอลัมน์เป็น nullable เพื่อให้ข้อมูลเดิมใช้งานต่อได้ทันที ค่าที่ไม่อยู่ในรายการจะถูกปฏิเสธทั้งจาก validation ของแอปและ database constraint

## ตัวเลือกและการประกอบชื่อ

กำหนดชุดตัวเลือกจริงไว้จุดเดียวเป็น `NAME_PREFIX_OPTIONS = ['นาย', 'น.ส.', 'นาง'] as const` แล้วให้ validator และ UI ใช้ชุดเดียวกัน dropdown จะแสดง `— ไม่ระบุ —` เพิ่มเป็นตัวเลือกว่างเฉพาะใน UI

สร้าง formatter กลางสำหรับชื่อที่รับ `name` และ `name_prefix`:

```ts
formatProfileName('สมหญิง ใจดี', 'นาง') // 'นางสมหญิง ใจดี'
formatProfileName('สมหญิง ใจดี', null)  // 'สมหญิง ใจดี'
```

formatter ต้อง trim ค่าและไม่สร้างช่องว่างระหว่าง prefix กับ name

## Data flow

### Personnel detail

`StaffDetailClient` โหลด `profile.name_prefix` → ตั้งค่า dropdown ใน state ของฟอร์ม → ส่ง `name_prefix` ผ่าน `PATCH /api/admin/personnel/[id]` → `PersonnelProfileSchema` ตรวจค่า → update `profiles` → response profile ใหม่ถูกใช้แสดงชื่อทันที

### User management

`AdminUserClient` โหลด `user.name_prefix` ในโหมดแก้ไข หรือเริ่มเป็นค่าว่างในโหมดเพิ่ม → ส่งค่าไปยัง `POST /api/admin/users` หรือ `PATCH /api/admin/users/[id]` → `createUserSchema`/`updateUserSchema` ตรวจค่า → `lib/services/users.ts` เขียน `name_prefix` ใน `profiles`

ฟิลด์ `name` ยังคงเป็นชื่อ-นามสกุลโดยไม่รวม prefix การประกอบเป็นชื่อที่แสดงใช้ formatter ที่ UI boundary เท่านั้น

## ไฟล์ที่คาดว่าจะเปลี่ยน

- `supabase/migrations/20260824100000_personnel_name_prefix.sql`
- `lib/supabase/types.ts`
- `types/users.ts`
- `lib/validations/user-schema.ts`
- `lib/validations/personnel.ts`
- `lib/personnel/name.ts` และ test ของ formatter
- `lib/services/users.ts`
- `app/api/admin/users/route.ts` และ route สำหรับ update user ตามความจำเป็นของ schema
- `app/api/admin/personnel/[id]/route.ts` ตามความจำเป็นของ schema ที่ใช้ร่วมกัน
- `app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx`
- `app/(protected)/staff/admin/AdminUserClient.tsx`
- personnel list/roster consumers ที่อยู่ในขอบเขตการแสดงชื่อ
- focused regression tests ใน `scripts/` หรือ `lib/`

จะตรวจสอบก่อนแก้ทุกไฟล์ว่า query แบบระบุคอลัมน์ต้องเพิ่ม `name_prefix` หรือไม่ ส่วน query ที่ใช้ `select('*')` ไม่ต้องแก้เพิ่มเติม

## Validation และ error handling

- `name_prefix` รับเฉพาะค่าใน `NAME_PREFIX_OPTIONS` หรือ `null`
- ค่า `''` จาก dropdown แปลงเป็น `null` ก่อน validation/บันทึก
- ถ้า payload ไม่ถูกต้อง API ตอบสถานะ `422` ตามรูปแบบเดิม
- ถ้า database constraint ปฏิเสธข้อมูล API ใช้ error handling เดิมและไม่แสดงข้อมูลที่บันทึกไม่สำเร็จเป็นข้อมูลสำเร็จ
- การบันทึกชื่อเดิมและข้อมูล personnel อื่นต้องไม่เปลี่ยน behavior เดิม

## แผนการทดสอบ

เขียน regression tests ก่อน implementation ตามลำดับ RED → GREEN:

1. formatter: prefix ติดกับชื่อ, null/ค่าว่างไม่สร้างช่องว่างนำหน้า, ชื่อที่มี whitespace ถูก trim
2. validation: รับ 3 ค่าและ `null`, ปฏิเสธค่าที่อยู่นอกชุด
3. personnel detail contract: มี field ใน form, โหลดค่าปัจจุบัน, และส่ง `name_prefix` ใน payload
4. user-management contract: dropdown ปรากฏทั้ง create/edit และ payload ของทั้งสองโหมดมี `name_prefix`
5. database migration contract: column และ check constraint มีอยู่ใน migration

คำสั่งตรวจสอบหลัง implementation:

```text
npx tsx lib/personnel/name.test.ts
npx tsx scripts/personnel-name-prefix.test.ts
npx tsc --noEmit
npm run build
```

## เกณฑ์รับงาน

- ผู้ดูแลเลือก `นาย`, `น.ส.`, `นาง` หรือ `— ไม่ระบุ —` ในหน้า personnel แล้วบันทึกได้
- เปิดหน้าเดิมอีกครั้งแล้ว dropdown แสดงค่าที่บันทึกไว้
- ผู้ดูแลเลือกและบันทึกคำนำหน้าได้ทั้งตอนเพิ่มและแก้ไขผู้ใช้งาน
- ชื่อที่แสดงเป็น `นางสมหญิง ใจดี` โดยไม่มีช่องว่างหลังคำนำหน้า
- ข้อมูลผู้ใช้เดิมที่ไม่มี prefix ยังแสดงและแก้ไขได้ตามปกติ
- focused tests, type-check และ production build ผ่าน
