-- งานคุณภาพ — ทีม/บทบาท เฉพาะรอบ (ad-hoc owner override)
--
-- แม่แบบ "อื่นๆ/ประชุมทั่วไป" มี owner_text คงที่ (เช่น "บุคลากรทุกคน") แต่งานเฉพาะกิจ
-- ที่สร้างจากแม่แบบนี้อาจเป็นทีมจริงต่างกันไป (เช่น งานโลหิตวิทยา, งานเคมีคลินิก)
-- คอลัมน์นี้ให้พิมพ์ทีม/บทบาทจริงต่อรอบได้ เหมือน period_label ที่เก็บหัวข้อจริงของรอบนั้นๆ
-- ไม่ตั้งไว้ = ใช้ owner_text ของแม่แบบตามเดิม
--
-- Run in Supabase Dashboard → SQL Editor. Idempotent.

ALTER TABLE public.quality_task_instances
  ADD COLUMN IF NOT EXISTS owner_text_override text;
