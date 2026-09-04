-- Per-person risk working group membership.
-- The application accesses this table only through server-side service-role routes.
CREATE TABLE IF NOT EXISTS public.risk_team_members (
  user_id    uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.risk_team_members ENABLE ROW LEVEL SECURITY;

-- Keep the membership table out of the client Data API. Server routes use service_role.
REVOKE ALL ON TABLE public.risk_team_members FROM anon, authenticated;
GRANT ALL ON TABLE public.risk_team_members TO service_role;
