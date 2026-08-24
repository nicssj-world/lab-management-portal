-- The compliance migration recreated the numeric KPI view with
-- security_invoker=true. That makes authenticated readers need direct
-- privileges on kpi_definition_versions, which is intentionally service-role
-- only. Restore the dashboard's existing view boundary so users can read the
-- approved KPI projection without exposing the version table itself.

ALTER VIEW public.vw_kpi_dashboard
  SET (security_invoker = false);

GRANT SELECT ON public.vw_kpi_dashboard TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
