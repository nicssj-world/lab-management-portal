-- Equipment Registry Module
-- Run in Supabase Dashboard → SQL Editor

CREATE TABLE IF NOT EXISTS equipment (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_no           integer,
  cbh_code          text UNIQUE,
  hospital_asset_no text,
  department        text NOT NULL,
  owner             text DEFAULT 'รพ',
  owner_status      text,
  risk_level        text CHECK (risk_level IN ('High', 'Medium', 'Low')),
  classification    text,
  equipment_type    text NOT NULL,
  manufacturer      text,
  model             text,
  serial_number     text,
  vendor            text,
  purchase_date     date,
  warranty_exp      date,
  purchase_price    numeric(12, 2),
  status            text DEFAULT 'Active'
                    CHECK (status IN ('Active', 'Inactive', 'ชำรุด', 'มาใหม่', 'ย้าย', 'สูญหาย')),
  needs_calibration boolean DEFAULT true,
  responsible_person text,
  remark            text,
  created_at        timestamptz DEFAULT now(),
  created_by        uuid REFERENCES profiles(id)
);

CREATE INDEX IF NOT EXISTS equipment_department_idx ON equipment(department);
CREATE INDEX IF NOT EXISTS equipment_status_idx ON equipment(status);
CREATE INDEX IF NOT EXISTS equipment_risk_level_idx ON equipment(risk_level);

CREATE TABLE IF NOT EXISTS equipment_calibrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id        uuid REFERENCES equipment(id) ON DELETE CASCADE,
  year                integer NOT NULL,
  month               integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  cal_type            text NOT NULL CHECK (cal_type IN ('PM', 'CAL')),
  planned             boolean DEFAULT false,
  completed_date      date,
  tech_group          text,
  purpose             text,
  operating_range     text,
  mpe                 text,
  acceptance_criteria text,
  notes               text,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (equipment_id, year, month, cal_type)
);

CREATE INDEX IF NOT EXISTS equipment_calibrations_equipment_idx ON equipment_calibrations(equipment_id);
CREATE INDEX IF NOT EXISTS equipment_calibrations_year_month_idx ON equipment_calibrations(year, month);

-- RLS: read for authenticated, write via service role only
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_calibrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "equipment_select" ON equipment FOR SELECT TO authenticated USING (true);
CREATE POLICY "equipment_calibrations_select" ON equipment_calibrations FOR SELECT TO authenticated USING (true);
