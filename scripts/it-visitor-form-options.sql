-- เพิ่มการตั้งค่าตัวเลือกของฟอร์มบันทึกการเข้า-ออก
-- รันหลัง scripts/it-visitor-log.sql สำหรับฐานข้อมูลที่มีตารางเดิมอยู่แล้ว

ALTER TABLE it_visitor_form_settings
  ADD COLUMN IF NOT EXISTS form_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE it_visitor_logs
  ADD COLUMN IF NOT EXISTS safety_ack_other text;
