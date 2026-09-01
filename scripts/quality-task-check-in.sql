-- ═══════════════════════════════════════════════════════════════════════════
-- งานคุณภาพ — QR check-in สำหรับการประชุม
--
-- QR 1 อันต่อ 1 รอบประชุม (quality_task_instances) → ผู้เข้าร่วมสแกนเพื่อเช็คอิน
-- ผลการเช็คอินไปปรากฏบน PDF ใบลงนาม (Fm-QP-LAB-25/01) แทนการเซ็นสด
--
-- ⚠️ เช็คอินต้องล็อกอิน — ไม่ใช่ฟอร์มสาธารณะแบบ it_visitor_logs
-- เหตุผลเชิงโครงสร้าง: participant_user_ids เป็น uuid[] ที่อ้าง profiles
-- การ "เพิ่มผู้เข้าร่วมที่ไม่อยู่ในรายชื่ออัตโนมัติ" จึงต้องรู้ profile id จริง
-- ชื่อที่พิมพ์เองจากฟอร์มสาธารณะเติมคอลัมน์นี้ไม่ได้ และใบลงนามเป็นบันทึกคุณภาพ
-- ตาม ISO 15189 ที่ต้องระบุตัวตนได้จริง
--
-- Run in Supabase Dashboard → SQL Editor. Idempotent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. token ต่อรอบประชุม ──
-- null = ยังไม่เคยออก QR สำหรับรอบนี้ (ออกให้ตอนกดปุ่มครั้งแรก ไม่ generate ล่วงหน้าทุกแถว)
ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS check_in_token text UNIQUE
    CHECK (check_in_token IS NULL OR length(check_in_token) >= 32);

-- null = ยังเปิดรับเช็คอิน · timestamp = เจ้าหน้าที่กดปิดรับเช็คอินแล้ว
-- (เมื่อ status เป็น completed ระบบจะปิดรับเช็คอินโดยอัตโนมัติใน application logic ด้วย)
ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS check_in_closed_at timestamptz;

-- null = ใช้เวลาเปิดอัตโนมัติตามกำหนดการ · timestamp = ผู้มีสิทธิ์เปิดรับก่อนเวลา
ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS check_in_opened_at timestamptz,
  ADD COLUMN IF NOT EXISTS check_in_opened_by uuid REFERENCES public.profiles(id);

-- ── 2. บันทึกการเช็คอิน ──
-- PK (instance_id, user_id) = idempotent โดยธรรมชาติ สแกนซ้ำไม่เกิดแถวซ้ำ
CREATE TABLE IF NOT EXISTS public.quality_task_check_ins (
  instance_id   uuid NOT NULL REFERENCES public.quality_task_instances(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.profiles(id),
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  -- 'qr' = สแกนเอง · 'manual' = เจ้าหน้าที่บันทึกแทน (เช่น มือถือแบตหมด)
  method        text NOT NULL DEFAULT 'qr' CHECK (method IN ('qr', 'manual')),
  -- true = ตอนเช็คอินคนนี้ยังไม่อยู่ในรายชื่อผู้เข้าร่วม ระบบเพิ่มให้อัตโนมัติ
  -- เก็บไว้เพื่อให้ใบลงนามระบุที่มาของแถวได้ และตรวจสอบย้อนหลังได้ว่าใครเป็นผู้เข้าร่วมนอกแผน
  was_unlisted  boolean NOT NULL DEFAULT false,
  recorded_by   uuid REFERENCES public.profiles(id),
  PRIMARY KEY (instance_id, user_id)
);

CREATE INDEX IF NOT EXISTS quality_task_check_ins_instance
  ON public.quality_task_check_ins(instance_id);

-- ── 3. RLS — เขียนผ่าน supabaseAdmin หลังตรวจสิทธิ์ฝั่ง server เท่านั้น ──
ALTER TABLE public.quality_task_check_ins ENABLE ROW LEVEL SECURITY;
