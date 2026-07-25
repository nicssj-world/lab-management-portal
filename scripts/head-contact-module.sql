-- ระบบ “สื่อสารถึงหัวหน้า” — ฟอร์มสาธารณะและทะเบียนรับเรื่องภายใน

CREATE TABLE IF NOT EXISTS head_contact_form_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  public_token text NOT NULL UNIQUE CHECK (length(public_token) >= 32),
  is_open boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS head_contact_service_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  display_order integer NOT NULL DEFAULT 0 CHECK (display_order BETWEEN 0 AND 10000),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS head_contact_service_units_name_uidx
  ON head_contact_service_units (lower(trim(name)));
CREATE INDEX IF NOT EXISTS head_contact_form_settings_updated_by_idx
  ON head_contact_form_settings(updated_by);
CREATE INDEX IF NOT EXISTS head_contact_service_units_updated_by_idx
  ON head_contact_service_units(updated_by);

CREATE TABLE IF NOT EXISTS head_contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_name text,
  contact_channel text,
  service_unit_id uuid REFERENCES head_contact_service_units(id) ON DELETE SET NULL,
  service_unit_snapshot text NOT NULL CHECK (char_length(trim(service_unit_snapshot)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN ('suggestion', 'complaint', 'compliment')),
  detail text NOT NULL CHECK (char_length(trim(detail)) BETWEEN 10 AND 5000),
  wants_reply boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  action_note text,
  contacted_at timestamptz,
  contact_note text,
  submission_key uuid NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES profiles(id),
  closed_at timestamptz,
  closed_by uuid REFERENCES profiles(id),
  CONSTRAINT head_contact_reply_contact_required
    CHECK (NOT wants_reply OR nullif(trim(contact_channel), '') IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS head_contact_submissions_created_idx ON head_contact_submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS head_contact_submissions_status_idx ON head_contact_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS head_contact_submissions_unit_idx ON head_contact_submissions(service_unit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS head_contact_submissions_reply_idx
  ON head_contact_submissions(created_at DESC) WHERE wants_reply AND contacted_at IS NULL;
CREATE INDEX IF NOT EXISTS head_contact_submissions_updated_by_idx ON head_contact_submissions(updated_by);
CREATE INDEX IF NOT EXISTS head_contact_submissions_closed_by_idx ON head_contact_submissions(closed_by);

ALTER TABLE head_contact_form_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE head_contact_service_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE head_contact_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON head_contact_form_settings FROM anon, authenticated;
REVOKE ALL ON head_contact_service_units FROM anon, authenticated;
REVOKE ALL ON head_contact_submissions FROM anon, authenticated;
GRANT ALL ON head_contact_form_settings TO service_role;
GRANT ALL ON head_contact_service_units TO service_role;
GRANT ALL ON head_contact_submissions TO service_role;

INSERT INTO head_contact_form_settings (singleton, public_token)
VALUES (true, rtrim(translate(encode(gen_random_bytes(32), 'base64'), '+/', '-_'), '='))
ON CONFLICT (singleton) DO NOTHING;

INSERT INTO head_contact_service_units (name, display_order) VALUES
  ('หน่วยเจาะเลือด นอก ร.พ. เซนทรัล ชลบุรี', 10),
  ('หน่วยเจาะเลือด นอก ร.พ. โรบินสันดอนหัวฬ่อ', 20),
  ('ห้องเจาะเลือด ร.พ.ชลบุรี', 30),
  ('ห้องเจาะเลือด ศูนย์สุขภาพชุมชนเมืองชลบุรี', 40),
  ('งานเคมีคลินิก', 50),
  ('งานโลหิตวิทยาคลินิก', 60),
  ('งานภูมิคุ้มกันวิทยาคลินิก', 70),
  ('งานจุลทรรศนศาสตร์คลินิก', 80),
  ('งานจุลชีววิทยาคลินิก', 90),
  ('งานธนาคารเลือด', 100),
  ('งานอณูชีววิทยาคลินิก', 110),
  ('งานห้องปฏิบัติการตรวจต่อ', 120),
  ('งานห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี', 130),
  ('งานธุรการกลุ่มงานเทคนิคการแพทย์', 140),
  ('แม่บ้าน', 150)
ON CONFLICT DO NOTHING;
