-- งานคุณภาพ — เช็คอินสำหรับผู้ไม่มีบัญชีในระบบ (guest check-in)
--
-- เดิม quality_task_check_ins บังคับ user_id (อ้าง profiles) เสมอ — คนที่ไม่มีบัญชีในระบบ
-- (เช่น แขกรับเชิญ/บุคลากรหน่วยงานอื่นที่ยังไม่มี profile) จึงเช็คอินไม่ได้เลย
-- Migration นี้เปิดทางให้บันทึกชื่อ-นามสกุล-หน่วยงานแทน โดยยังคงบังคับว่าทุกแถวต้องระบุ
-- ตัวตนได้จริงอย่างใดอย่างหนึ่ง (user_id หรือ guest_* ครบชุด) ตามข้อกำหนด ISO 15189
--
-- Run in Supabase Dashboard → SQL Editor. Idempotent.

-- ── 1. PK เดิมคือ (instance_id, user_id) — ต้องดร็อปก่อน เพราะ Postgres ไม่ยอมให้คอลัมน์
-- ที่เป็นส่วนหนึ่งของ primary key เป็น null ได้ (แก้ user_id ก่อนเจอ 42P16)
-- เปลี่ยนเป็น surrogate id แล้วคง idempotency ของผู้ใช้จริงด้วย unique index บางส่วนแทน
ALTER TABLE public.quality_task_check_ins
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.quality_task_check_ins SET id = gen_random_uuid() WHERE id IS NULL;

ALTER TABLE public.quality_task_check_ins ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'quality_task_check_ins_pkey' AND conrelid = 'public.quality_task_check_ins'::regclass
  ) THEN
    ALTER TABLE public.quality_task_check_ins DROP CONSTRAINT quality_task_check_ins_pkey;
  END IF;
END $$;

ALTER TABLE public.quality_task_check_ins ADD PRIMARY KEY (id);

-- ── 2. เปิดให้ user_id เป็น null ได้ (PK เดิมที่กันไว้ถูกดร็อปไปแล้ว) + เพิ่มคอลัมน์ guest ──
ALTER TABLE public.quality_task_check_ins
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.quality_task_check_ins
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_surname text,
  ADD COLUMN IF NOT EXISTS guest_department text;

-- สแกนซ้ำของผู้ใช้จริงยังต้องเป็น idempotent เหมือนเดิม (PK เดิมเคยรับประกันไว้)
CREATE UNIQUE INDEX IF NOT EXISTS quality_task_check_ins_instance_user
  ON public.quality_task_check_ins(instance_id, user_id) WHERE user_id IS NOT NULL;

-- ── 3. ทุกแถวต้องระบุตัวตนได้จริง: user_id หรือ guest ครบชุดอย่างใดอย่างหนึ่ง ──
ALTER TABLE public.quality_task_check_ins
  DROP CONSTRAINT IF EXISTS quality_task_check_ins_identity_check;
ALTER TABLE public.quality_task_check_ins
  ADD CONSTRAINT quality_task_check_ins_identity_check CHECK (
    (user_id IS NOT NULL)
    OR (nullif(trim(guest_name), '') IS NOT NULL AND nullif(trim(guest_surname), '') IS NOT NULL AND nullif(trim(guest_department), '') IS NOT NULL)
  );

-- ── 4. method รองรับ 'guest' เพิ่มจาก 'qr'/'manual' เดิม ──
ALTER TABLE public.quality_task_check_ins
  DROP CONSTRAINT IF EXISTS quality_task_check_ins_method_check;
ALTER TABLE public.quality_task_check_ins
  ADD CONSTRAINT quality_task_check_ins_method_check CHECK (method IN ('qr', 'manual', 'guest'));
