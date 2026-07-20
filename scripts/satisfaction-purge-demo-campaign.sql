-- One-off cleanup: permanently remove a DEMO/test campaign together with its
-- simulated responses. Run manually in Supabase Dashboard -> SQL Editor.
--
-- WARNING: this is a hard delete. Survey responses are anonymous by design and
-- cannot be reconstructed. Only run this against a campaign whose data was
-- fabricated for a demo. Never run it against a real collection round.
--
-- Usage: replace the campaign id below, then run STEP 1 and read the output
-- before running STEP 2.

-- ---------------------------------------------------------------------------
-- STEP 1 - preview. Confirm this is the campaign you mean before deleting.
-- ---------------------------------------------------------------------------
with target as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
select
  c.name,
  c.status,
  s.code                                                    as survey_code,
  (select count(*) from public.survey_responses r where r.campaign_id = c.id)        as responses,
  (select count(*) from public.survey_answers a where a.campaign_id = c.id)          as answers,
  (select count(*) from public.survey_kpi_publications k where k.campaign_id = c.id) as kpi_publications
from public.survey_campaigns c
join public.surveys s on s.id = c.survey_id
where c.id = (select id from target);

-- ---------------------------------------------------------------------------
-- STEP 2 - delete. Children are removed first because survey_responses,
-- survey_answers and survey_kpi_publications reference the campaign with
-- ON DELETE RESTRICT. survey_response_devices and survey_response_events
-- cascade on their own.
--
-- If STEP 1 reported kpi_publications > 0, the KPI value was already pushed to
-- public.kpi_satisfaction, which has no foreign key back to the campaign. That
-- row is NOT removed here - delete it separately and deliberately, otherwise
-- the KPI dashboard keeps a number with no traceable source.
-- ---------------------------------------------------------------------------
begin;

with target as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
delete from public.survey_kpi_publications where campaign_id = (select id from target);

with target as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
delete from public.survey_answers where campaign_id = (select id from target);

with target as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
delete from public.survey_responses where campaign_id = (select id from target);

with target as (select '00000000-0000-0000-0000-000000000000'::uuid as id)
delete from public.survey_campaigns where id = (select id from target);

commit;
