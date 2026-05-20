-- Fix tube_color for records where tube is set but tube_color is missing or default gray
UPDATE tests SET tube_color = CASE tube
  WHEN 'Sodium citrate (ฟ้า)'         THEN '#25a6eb'
  WHEN 'Clotted blood (แดง)'           THEN '#EF4444'
  WHEN 'Lithium heparin (เขียว)'       THEN '#10B981'
  WHEN 'EDTA (ม่วง)'                   THEN '#9333EA'
  WHEN 'NaF (เทา)'                     THEN '#94A3B8'
  WHEN 'Urine'                         THEN '#FACC15'
  WHEN 'Stool'                         THEN '#92400E'
  WHEN 'Hemoculture aerobic (ผู้ใหญ่)' THEN '#B91C1C'
  WHEN 'Hemoculture aerobic (เด็ก)'    THEN '#B91C1C'
  WHEN 'Hemoculture fungi/TB'          THEN '#B91C1C'
  WHEN 'Blood gas syringe'             THEN '#B91C1C'
  WHEN 'Blood gas capillary tube'      THEN '#B91C1C'
  WHEN 'Cowin tube'                    THEN '#F59E0B'
  WHEN 'Random urine'                  THEN '#FACC15'
  WHEN 'อื่นๆ'                         THEN '#000000'
  ELSE '#94A3B8'
END
WHERE tube IS NOT NULL AND (tube_color IS NULL OR tube_color = '#94A3B8');
