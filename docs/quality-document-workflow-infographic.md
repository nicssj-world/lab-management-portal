# Quality Document Workflow Infographic

## Visual Philosophy: Clinical Pathways

Clinical Pathways treats document control as a calm, observable system: every revision moves through a clear corridor, every handoff leaves a visible trace, and every official file has one stable place to live. The visual language should feel precise, quiet, and trustworthy, like a laboratory form redesigned by someone who deeply understands both compliance and daily work.

The composition relies on three parallel flows, each with a distinct color signal, but all aligned to the same disciplined grid. Space is used as reassurance: no crowding, no decorative confusion, only carefully placed steps, role labels, and small guardrails that help the user understand what to do next. The result should look meticulously crafted, with painstaking alignment and master-level attention to hierarchy.

Color communicates status and responsibility. Blue anchors new official document control, amber marks legacy/current-version migration, and green marks the revision update pathway. Neutral lines and pale backgrounds keep the work-focused tone appropriate for hospital users. The design must feel like the product of deep expertise rather than a poster full of slogans.

Typography should be sparse and utilitarian. Thai labels carry the workflow; English appears only where it clarifies system terms such as Draft, Review, Approved, Published, `file_url`, and backfill. Text is concise, never paragraph-heavy. The final piece should feel polished enough to print, pin near the DC workflow desk, or place in a user guide.

## User-Facing Content

Title: ระบบเอกสารคุณภาพ: เลือก Flow ให้ถูกก่อนอัปโหลด

Flow 1: สร้าง Draft ตาม workflow ปกติ
- ใช้ได้ทั้ง Rev.00 และ Rev.>0 เมื่อเอกสารต้องเริ่มจาก DOCX/XLSX
- Reviewer สร้าง Draft
- ใส่ Rev ที่ต้องการ เช่น Rev.00 หรือ Rev.01
- Upload Word/Excel ต้นฉบับ
- QP/WI: DCC/Admin ตรวจ draft และ upload PDF เนื้อหาแบบไม่มีหน้าปก
- DCC/Admin ส่ง Draft -> Review
- Manager/Admin ส่ง Review -> Approved
- Quality Manager/Laboratory Director/Admin ส่ง Approved -> Published
- ระบบสร้างหน้าปกและ final PDF

Flow 2: อัปโหลดเอกสารใหม่ Rev.>0
- ใช้เมื่อเป็นเอกสารเก่าจากระบบเดิม และต้องการนำ Rev ปัจจุบันเข้าเป็น Published ทันที
- เลือกโหมด “นำเข้าเอกสารเดิม Rev.>0”
- สร้างเอกสารด้วย Rev ปัจจุบัน เช่น Rev.10 และ status Published
- Upload ไฟล์ทางการของ Rev ปัจจุบันทันที
- QP/WI: ใช้ PDF ทางการเดิมที่มีหน้าปกอยู่แล้ว
- เพิ่มประวัติย้อนหลัง Rev.00-Rev.09
- ประวัติย้อนหลังไม่เปลี่ยนไฟล์ทางการปัจจุบัน
- สิทธิ์: Admin + DCC

Flow 3: อัปเดตการแก้ไข เพิ่ม Rev.
- ใช้เมื่อเอกสาร Published ต้องแก้เนื้อหา
- กดสร้าง Revision ใหม่
- ระบบสร้าง Working Draft Rev ถัดไป
- Reviewer upload Word/Excel ฉบับแก้ไข
- DCC/Admin ตรวจ draft, upload PDF/official file, แล้วส่ง Draft -> Review
- Manager/Admin ส่ง Review -> Approved
- Quality Manager/Laboratory Director/Admin ส่ง Approved -> Published
- ระบบ archive Rev เดิม และ promote Rev ใหม่

Key Reminders
- `file_url` = ไฟล์ทางการปัจจุบันเท่านั้น
- Word/Excel source ห้าม promote ทับ `file_url` อัตโนมัติ
- Rev.>0 ที่เริ่มจาก DOCX/XLSX ให้ใช้ Flow 1 ไม่ใช่ Import Current
- QP/WI ต้องมี source + PDF เนื้อหาก่อน DCC/Admin ส่งเข้า Review
- QP/WI มีหน้าปกและลายเซ็นระบบ
- Fm/Rf/Cf ไม่ต้องมีหน้าปกและไม่ stamp signature
- Published ห้ามแก้ไฟล์โดยตรง ต้องสร้าง Revision ใหม่
- Header ที่ไม่มีอยู่ใน source จะไม่ถูกสร้างเพิ่มโดยอัตโนมัติ ให้ตรวจ PDF ก่อน Published
