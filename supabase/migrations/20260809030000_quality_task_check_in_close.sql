-- ปิดรับ QR check-in ของรอบงานคุณภาพได้ด้วยตนเอง
BEGIN;

ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS check_in_closed_at timestamptz;

NOTIFY pgrst, 'reload schema';
COMMIT;
