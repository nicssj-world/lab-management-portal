-- Keep a person's personnel department while allowing the public team-org chart
-- to omit profiles that do not belong in the displayed organization.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_org_visible boolean NOT NULL DEFAULT true;
