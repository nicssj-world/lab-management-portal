-- MT-CBH Staff / Personnel Module — annual paperless agreements
-- Run via Supabase Dashboard → SQL Editor. Safe to re-run.
-- The Data API is intentionally not granted access; all requests use audited server routes.

CREATE TABLE IF NOT EXISTS staff_agreement_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year integer NOT NULL UNIQUE CHECK (fiscal_year BETWEEN 2500 AND 2700),
  title text NOT NULL,
  opens_on date NOT NULL,
  due_on date NOT NULL CHECK (due_on >= opens_on),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'open', 'approved')),
  agreement_document_snapshot jsonb NOT NULL,
  disclosure_document_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  opened_at timestamptz,
  approved_at timestamptz,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approval_actor_snapshot jsonb,
  approval_signature_url text,
  approval_signature_method text CHECK (approval_signature_method IN ('drawn', 'saved')),
  approval_manifest_sha256 text,
  locked_at timestamptz
);
ALTER TABLE staff_agreement_campaigns
  ADD COLUMN IF NOT EXISTS approval_actor_snapshot jsonb;
CREATE INDEX IF NOT EXISTS staff_agreement_campaigns_status_idx ON staff_agreement_campaigns(status, fiscal_year DESC);

CREATE TABLE IF NOT EXISTS staff_agreement_campaign_recipients (
  campaign_id uuid NOT NULL REFERENCES staff_agreement_campaigns(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'certified', 'exempt')),
  exempt_reason text,
  exempted_at timestamptz,
  exempted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  evidence_url text,
  evidence_sha256 text,
  certification_batch_id uuid,
  certified_at timestamptz,
  certified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  certification_actor_snapshot jsonb,
  certification_signature_url text,
  certification_signature_method text CHECK (certification_signature_method IN ('drawn', 'saved')),
  certification_manifest_sha256 text,
  PRIMARY KEY (campaign_id, profile_id),
  CHECK ((status = 'exempt') = (exempted_at IS NOT NULL)),
  CHECK (status <> 'exempt' OR length(trim(coalesce(exempt_reason, ''))) > 0)
);
CREATE INDEX IF NOT EXISTS staff_agreement_recipients_status_idx ON staff_agreement_campaign_recipients(campaign_id, status);
CREATE INDEX IF NOT EXISTS staff_agreement_recipients_profile_idx ON staff_agreement_campaign_recipients(profile_id, status);

-- Safe upgrade for databases created before incremental group-lead certification.
ALTER TABLE staff_agreement_campaign_recipients
  DROP CONSTRAINT IF EXISTS staff_agreement_campaign_recipients_status_check;
ALTER TABLE staff_agreement_campaign_recipients
  ADD CONSTRAINT staff_agreement_campaign_recipients_status_check CHECK (status IN ('pending', 'completed', 'certified', 'exempt'));
ALTER TABLE staff_agreement_campaign_recipients
  ADD COLUMN IF NOT EXISTS certification_batch_id uuid,
  ADD COLUMN IF NOT EXISTS certified_at timestamptz,
  ADD COLUMN IF NOT EXISTS certified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS certification_actor_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS certification_signature_url text,
  ADD COLUMN IF NOT EXISTS certification_signature_method text CHECK (certification_signature_method IN ('drawn', 'saved')),
  ADD COLUMN IF NOT EXISTS certification_manifest_sha256 text;
CREATE INDEX IF NOT EXISTS staff_agreement_recipients_certification_idx ON staff_agreement_campaign_recipients(campaign_id, status, certification_batch_id);

-- Preserve already chronological approvals when upgrading from the original
-- campaign-wide approval model. Later signers remain `completed` and wait for
-- the next group-lead certification batch.
UPDATE staff_agreement_campaign_recipients AS recipient
SET
  status = 'certified',
  certified_at = campaign.approved_at,
  certified_by = campaign.approved_by,
  certification_actor_snapshot = campaign.approval_actor_snapshot,
  certification_signature_url = campaign.approval_signature_url,
  certification_signature_method = campaign.approval_signature_method,
  certification_manifest_sha256 = campaign.approval_manifest_sha256
FROM staff_agreement_campaigns AS campaign
WHERE recipient.campaign_id = campaign.id
  AND recipient.status = 'completed'
  AND campaign.approval_signature_url IS NOT NULL
  AND campaign.approved_at IS NOT NULL
  AND recipient.completed_at <= campaign.approved_at;

CREATE TABLE IF NOT EXISTS staff_agreement_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  agreement_type text NOT NULL CHECK (agreement_type IN ('confidentiality', 'impartiality')),
  document_snapshot jsonb NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  signed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  signing_method text NOT NULL CHECK (signing_method IN ('drawn', 'saved')),
  signature_snapshot_url text NOT NULL,
  UNIQUE (campaign_id, profile_id, agreement_type),
  FOREIGN KEY (campaign_id, profile_id) REFERENCES staff_agreement_campaign_recipients(campaign_id, profile_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS staff_agreement_acknowledgements_profile_idx ON staff_agreement_acknowledgements(profile_id, accepted_at DESC);

CREATE TABLE IF NOT EXISTS staff_activity_disclosures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  has_activity boolean NOT NULL,
  activity_name text,
  activity_date text,
  place text,
  impacts text[] NOT NULL DEFAULT '{}',
  impact_notes text,
  document_snapshot jsonb NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  signed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  signing_method text NOT NULL CHECK (signing_method IN ('drawn', 'saved')),
  signature_snapshot_url text NOT NULL,
  UNIQUE (campaign_id, profile_id),
  FOREIGN KEY (campaign_id, profile_id) REFERENCES staff_agreement_campaign_recipients(campaign_id, profile_id) ON DELETE CASCADE,
  CHECK (
    NOT has_activity OR (
      length(trim(coalesce(activity_name, ''))) > 0
      AND length(trim(coalesce(activity_date, ''))) > 0
      AND length(trim(coalesce(place, ''))) > 0
      AND cardinality(impacts) > 0
    )
  )
);
CREATE INDEX IF NOT EXISTS staff_activity_disclosures_campaign_idx ON staff_activity_disclosures(campaign_id, has_activity);

ALTER TABLE staff_agreement_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_agreement_campaign_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_agreement_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_activity_disclosures ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  staff_agreement_campaigns,
  staff_agreement_campaign_recipients,
  staff_agreement_acknowledgements,
  staff_activity_disclosures
FROM anon, authenticated;

-- Private bucket. Server routes authorize every read/download and create short-lived URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'staff-agreements', 'staff-agreements', false, 10485760,
  ARRAY['image/png', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
