-- ═══════════════════════════════════════════════════════════════════════════
-- บันทึกการเข้า-ออก (Visitor Log) — โมดูลงาน IT
--
-- แทน Google Form "แบบบันทึกขออนุมัติเข้ากลุ่มงานเทคนิคการแพทย์รายบุคคล"
-- QR 1 อัน 1 ลิงก์ ติดหน้าห้องปฏิบัติการ → ผู้มาติดต่อเลือกกรอกแบบรายบุคคล/หมู่คณะ
--
-- Run in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Settings — singleton ถือ public token ของ QR ──
-- check (singleton) บังคับให้ตารางมีได้แถวเดียว = QR อันเดียวตามที่ออกแบบไว้
CREATE TABLE IF NOT EXISTS it_visitor_form_settings (
  singleton    boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  public_token text NOT NULL UNIQUE CHECK (length(public_token) >= 32),
  is_open      boolean NOT NULL DEFAULT true,          -- สวิตช์เปิด/ปิดรับฟอร์ม
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   uuid REFERENCES profiles(id)
);

-- ── 2. Visitor log — ตารางเดียว รองรับทั้งรายบุคคลและหมู่คณะผ่าน visit_type ──
CREATE TABLE IF NOT EXISTS it_visitor_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visit_type      text NOT NULL CHECK (visit_type IN ('individual', 'group')),
  visit_date      date NOT NULL,
  -- รายบุคคล = ชื่อ-สกุลผู้มา · หมู่คณะ = หัวหน้าคณะ/ผู้ประสานงาน
  visitor_name    text NOT NULL,
  group_name      text,                                -- หมู่คณะเท่านั้น
  member_names    text,                                -- หมู่คณะเท่านั้น — รายชื่ออิสระ 1 คน/บรรทัด
  -- จำนวนคนทั้งหมดรวมผู้กรอก: รายบุคคลกรอก "ผู้ติดตาม N" → เก็บ N+1 · หมู่คณะกรอก "ทั้งหมด N" → เก็บ N
  party_size      integer NOT NULL DEFAULT 1 CHECK (party_size BETWEEN 1 AND 500),
  phone           text NOT NULL,
  email           text,
  org_type        text NOT NULL CHECK (org_type IN ('internal', 'external')),
  org_name        text NOT NULL,
  contact_dept    text NOT NULL,                       -- ค่าจาก DEPARTMENTS หรือข้อความอิสระเมื่อเลือก "อื่นๆ"
  entered_at      timestamptz NOT NULL,
  exited_at       timestamptz,                         -- null = ยังอยู่ในพื้นที่
  activity_type   text NOT NULL CHECK (activity_type IN (
                    'maintenance', 'sales_visit', 'send_lab',
                    'utility_safety', 'audit', 'lab_tour', 'other')),
  activity_other  text,                                -- บังคับเมื่อ activity_type = 'other' (บังคับที่ zod)
  appointment     text NOT NULL CHECK (appointment IN ('booked', 'walk_in')),
  badge_exchanged text NOT NULL CHECK (badge_exchanged IN ('yes', 'no')),
  safety_ack      text NOT NULL CHECK (safety_ack IN ('acknowledged', 'declined')),
  submission_key  uuid NOT NULL UNIQUE,                -- idempotency — กดส่งซ้ำไม่เกิดแถวซ้ำ
  created_at      timestamptz DEFAULT now(),
  closed_by       uuid REFERENCES profiles(id),        -- ใครกดบันทึกเวลาออก
  closed_at       timestamptz,
  CONSTRAINT it_visitor_logs_group_name_required
    CHECK (visit_type <> 'group' OR group_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS it_visitor_visit_date_idx ON it_visitor_logs(visit_date DESC);
CREATE INDEX IF NOT EXISTS it_visitor_entered_idx    ON it_visitor_logs(entered_at DESC);
CREATE INDEX IF NOT EXISTS it_visitor_dept_idx       ON it_visitor_logs(contact_dept);
-- ค้น "ยังอยู่ในพื้นที่" ตรง ๆ โดยไม่ต้องสแกนทั้งตาราง
CREATE INDEX IF NOT EXISTS it_visitor_open_idx
  ON it_visitor_logs(entered_at DESC) WHERE exited_at IS NULL;

-- ── 3. RLS ──
-- it_visitor_logs: read for authenticated, write via service role only (ตาม pattern โมดูล IT)
ALTER TABLE it_visitor_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "it_visitor_logs_select" ON it_visitor_logs;
CREATE POLICY "it_visitor_logs_select" ON it_visitor_logs FOR SELECT TO authenticated USING (true);

-- ⚠️ it_visitor_form_settings ต่างจากตารางอื่นในโมดูล IT — ถือ public_token
-- ที่ใครได้ไปก็ยิงฟอร์มสาธารณะได้ จึงเปิด RLS โดย "ไม่สร้าง policy ใด ๆ" + revoke
-- เจ้าหน้าที่เห็น token ผ่าน API route ที่ผ่าน requireVisitorLog แล้วเท่านั้น
ALTER TABLE it_visitor_form_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON it_visitor_form_settings FROM anon, authenticated;
GRANT ALL ON it_visitor_form_settings TO service_role;

-- ── 4. Seed — settings แถวเดียวพร้อม token สุ่ม 256 บิต (base64url) ──
INSERT INTO it_visitor_form_settings (singleton, public_token)
VALUES (
  true,
  rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '=')
)
ON CONFLICT (singleton) DO NOTHING;

-- ── 5. Seed permissions — ทุก role ยกเว้น Assistant ──
-- Assistant ไม่ใส่แถว (ไม่มีแถว = none) · Admin ได้ edit จาก hardcode ใน lib/permissions.ts
INSERT INTO role_permissions (role, resource, granted) VALUES
  ('Manager',                    'บันทึกการเข้า-ออก:edit', true),
  ('Medical Technologist',       'บันทึกการเข้า-ออก:edit', true),
  ('Medical Science Technician', 'บันทึกการเข้า-ออก:edit', true)
ON CONFLICT (role, resource) DO UPDATE SET granted = excluded.granted;
