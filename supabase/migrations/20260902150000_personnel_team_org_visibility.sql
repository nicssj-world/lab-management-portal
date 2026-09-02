-- Keep a person's personnel department while allowing the department box in
-- the team-org chart to omit profiles that do not belong in that box.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS team_org_visible boolean NOT NULL DEFAULT true;
