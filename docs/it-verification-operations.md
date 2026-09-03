# IT Data Transfer Verification — Operations Runbook

เอกสารนี้เป็นขั้นตอนนำ feature `ทวนสอบการส่งผ่านข้อมูล HIS & LIS` ขึ้นใช้งานในระบบเดิม

## ก่อนเปิดใช้งาน

1. ตรวจว่า branch และ environment ที่กำลังใช้งานตรงกับ `lab-management-portal` แล้ว
2. เปิด Supabase SQL Editor และรัน migration ใน repository:

   `supabase/migrations/20260904100000_it_verification.sql`

   การ implement นี้สร้าง migration ไว้ให้แล้ว แต่ไม่ได้ apply ไปยัง production อัตโนมัติ
3. ตรวจผล migration ว่ามี 6 ตาราง, RLS และ function ต่อไปนี้:

   - `it_verification_rounds`
   - `it_verification_sampling_runs`
   - `it_verification_samples`
   - `it_verification_findings`
   - `it_verification_assignees`
   - `it_verification_section_map`
   - `generate_it_verification_samples_from_tat(...)`
   - `resample_it_verification_samples_from_tat(...)`
   - `update_it_verification_sample(...)`
   - `import_it_verification_legacy_form(...)` (service-role only)

4. ตรวจ mapping seed 7 รายการจาก TAT และเติม mapping ของ `POCT2` หรือ `ตรวจพิเศษและปฏิบัติการตรวจต่อ` เมื่อเจ้าของงานยืนยันหน่วยงานปลายทางแล้ว
5. กำหนดสมาชิกคณะทำงาน IT ใน `it_editors` และมอบหมายผู้รับผิดชอบแต่ละหน่วยงานจากหน้าตั้งค่า

## การใช้งานประจำเดือน

- อัปโหลด TAT ตาม flow เดิมได้ตามปกติ เมื่อ final chunk สำเร็จระบบจะสุ่มตัวอย่างแบบ synchronous
- หาก sampler ใช้งานไม่ได้ การอัปโหลด TAT ยังสำเร็จ และ response จะแจ้ง `sampling.warning`; ให้เปิดหน้า Verification แล้วกดสร้างตัวอย่างใหม่หลังแก้สาเหตุ
- ระบบสุ่ม distinct LN ที่ trim แล้วด้วย `md5(seed || '|' || ln)` (`ln-hash-v1`) และเก็บเฉพาะ LN กับ metadata ที่จำเป็น ไม่เก็บชื่อผู้ป่วยหรือ HN
- การอัปโหลดเดือนเดิมซ้ำจะ reuse upload row และคง active sample เดิมไว้; sampling run ที่สำเร็จจะตอบ `skipped_existing`
- `row_count` เป็น snapshot ของ upload เท่านั้น; หาก raw `tat_records` ถูก cleanup แล้ว ไฟล์เดิมจะสุ่มซ้ำไม่ได้ ต้องอัปโหลดไฟล์ใหม่
- การสุ่มใหม่ต้องมีเหตุผล ระบบจะ void run/sample เดิมและเก็บหลักฐานเดิมไว้เสมอ

## Cleanup raw

ตั้งค่า `VERIFICATION_SAMPLING_GO_LIVE` ได้เฉพาะกรณีทดสอบ/ควบคุม หากไม่ตั้งค่าจะใช้ `2026-09-01` โดยอัตโนมัติ

หลัง go-live `scripts/tat-clean-raw.mjs` จะลบ raw ได้เมื่อทุกหน่วยงานเป้าหมายมี run ของ upload นั้นเป็น `completed`, `skipped_existing` หรือ `no_population` และไม่มี warning mapping ที่ยังไม่แก้ หากจำเป็นต้องใช้ `--force` ให้ตรวจผลกระทบก่อนเสมอ เพราะระบบจะแสดงคำเตือนและเขียน audit action `it_verification.raw_cleanup.force`

ข้อมูลก่อน go-live ยังคงพฤติกรรม cleanup เดิม

## Legacy evidence

แบบฟอร์มย้อนหลังจาก Google Drive ใช้โหมด `legacy_manual` ไม่ใช่การสุ่มจาก TAT โดยตรง
ตัวนำเข้าจะอ่านไฟล์แบบ read-only ผ่าน XLSX export, ใช้ปี พ.ศ. จากโฟลเดอร์เป็นหลัก,
อ่านแท็บ Q1–Q4 ทุกแท็บ, แปลง `LAB ID` เป็น `LN` และ `P` เป็น `pass` แล้วคงรอบเป็น `draft`
เพื่อให้ผู้รับผิดชอบตรวจสอบก่อนส่ง แบบฟอร์มว่างจะสร้างเฉพาะรอบ draft และไม่สร้าง sample ปลอม

ตรวจ preview ก่อนเสมอ (คำสั่งนี้ไม่เขียนฐานข้อมูล):

```text
npm run it-verification:drive-import
```

เลือกปีได้ด้วย `--years`:

```text
npm run it-verification:drive-import -- --years 2567,2568,2569
```

เมื่อตรวจ preview แล้ว ให้ apply ด้วย actor UUID ของผู้ดำเนินการเท่านั้น:

```text
npm run it-verification:drive-import -- --years 2567,2568,2569 --apply --actor-id <uuid>
```

ตัวนำเข้า idempotent ต่อรอบ/หน่วยงาน/ปี และจะ skip รอบที่มี `legacy-form-v1` อยู่แล้ว
ไม่แก้ไขไฟล์หรือสิทธิ์ใน Google Drive และไม่ใส่ `source_month`, test name, เวลา หรือข้อมูลผู้ป่วยที่ไม่มีในแบบฟอร์ม

สำหรับข้อมูล legacy ที่เตรียมเป็น CSV/TSV เอง ยังใช้ importer เดิมได้:

```text
npm run it-verification:legacy -- --file evidence.tsv --round-id <uuid> --department-id 11 --actor-id <uuid>
```

ไฟล์ต้องมี `ln`; เดือนและ metadata ที่ไม่มีหลักฐานให้เว้นว่าง ห้ามใส่ HN หรือชื่อผู้ป่วย

## PDF และการควบคุมเอกสาร

การ export ใช้เอกสาร Published `FM-QP-LAB-24-02` จาก Document Control เป็นต้นฉบับ, แสดงรหัสแบบฟอร์ม `Fm-QP-LAB-24/02`, revision และ effective date จากเอกสารนั้น และเพิ่มหน้าสรุป findings เมื่อมีประเด็น

ก่อนเปิดใช้งานจริงให้ตรวจไฟล์ PDF หนึ่งฉบับด้วยสายตา และยืนยันว่าไม่มีชื่อผู้ป่วยหรือ HN
