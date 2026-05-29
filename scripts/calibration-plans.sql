-- calibration_plans table
-- Run via Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS calibration_plans (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  group_name  text        NOT NULL,
  name        text        NOT NULL,
  plan        integer     NOT NULL DEFAULT 0,
  actual      integer,
  price       integer,
  budget      integer     NOT NULL DEFAULT 0,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  created_by  uuid,
  updated_at  timestamptz DEFAULT now()
);

-- Seed: แผนสอบเทียบ ปี 2566
INSERT INTO calibration_plans (group_name, name, plan, actual, price, budget, sort_order) VALUES
('1. ตู้ปลอดเชื้อ',   'ตู้ปลอดเชื้อ (Biosafety Cabinet)',                   15,   15, 60990, 914850,  1),
('2. ISO 15189',        'เครื่องนึ่งฆ่าเชื้อ (Autoclave)',                    4,    3,  1500,   4500,  2),
('2. ISO 15189',        'เครื่องปั่นตกตะกอน (Centrifuge)',                    42,  18,  NULL,  30000,  3),
('2. ISO 15189',        'เครื่องปั่นเม็ดเลือด (Hematocrit)',                  5,    2,  1500,   3000,  4),
('2. ISO 15189',        'เครื่องเขย่าสาร (Rotator Shaker)',                   6,    2,  1500,   3000,  5),
('2. ISO 15189',        'อ่างน้ำควบคุม (Water Bath)',                         3,    2,  1500,   3000,  6),
('2. ISO 15189',        'ตู้เพาะเชื้อ (Incubator)',                           5,    2,  1500,   3000,  7),
('2. ISO 15189',        'เครื่องชั่งสาร (Analytical Balance)',                4,    1,  1500,   1500,  8),
('2. ISO 15189',        'ตู้เย็นเก็บส่วนประกอบเลือด',                        10,   9,  2000,  18000,  9),
('2. ISO 15189',        'ตู้เย็นเก็บน้ำยา 2 ประตู',                          30,  18,  2000,  36000, 10),
('2. ISO 15189',        'Digital Thermometer',                                 50,   8,   800,   6400, 11),
('2. ISO 15189',        'Thermometer-Hygometer',                               20,   6,   800,   4800, 12),
('2. ISO 15189',        'Autopipette',                                         55,  27,  1000,  27000, 13),
('2. ISO 15189',        'Dry bath / Tube warmer / Heating block',              4,  NULL, 2000,      0, 14),
('2. ISO 15189',        'เครื่องบ่มเกร็ดเลือด (Platelet Incubator)',          0,    0,  NULL,      0, 15),
('3. Osmometer',        'Osmometer',                                           1,    1, 14000,  14000, 16),
('4. Microbilirubin',   'Microbilirubin Meter',                                2,    2, 12000,  24000, 17),
('5. กล้องจุลทรรศน์',  'กล้องจุลทรรศน์ (Microscope)',                       25,  NULL,30000,  30000, 18),
('6. ระบบอุณหภูมิ',    'ระบบบันทึกอุณหภูมิอัตโนมัติ',                       5,    0, 38200,  38200, 19)
ON CONFLICT DO NOTHING;
