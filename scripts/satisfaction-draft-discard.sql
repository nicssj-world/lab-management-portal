-- Apply this delta once to an environment where satisfaction-survey-module.sql
-- has already been applied.
create or replace function public.discard_survey_draft(
  p_survey_id uuid,
  p_version_id uuid,
  p_actor_id uuid
)
returns table(action text, restored_version_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_draft public.survey_versions%rowtype;
  v_previous_version_id uuid;
begin
  if p_actor_id is null then
    raise exception 'Actor is required';
  end if;

  select * into v_draft
  from public.survey_versions
  where id = p_version_id and survey_id = p_survey_id
  for update;
  if not found or v_draft.status <> 'draft' then
    raise exception 'Draft survey version not found';
  end if;

  select id into v_previous_version_id
  from public.survey_versions
  where survey_id = p_survey_id
    and status = 'published'
    and version_number < v_draft.version_number
  order by version_number desc
  limit 1;

  delete from public.survey_versions where id = v_draft.id;

  if v_previous_version_id is null then
    update public.surveys
    set archived_at = coalesce(archived_at, now()), updated_at = now()
    where id = p_survey_id;
    return query select 'archived'::text, null::uuid;
  end if;

  update public.surveys as survey
  set title = version.title,
      description = version.description,
      archived_at = null,
      updated_at = now()
  from public.survey_versions as version
  where survey.id = p_survey_id and version.id = v_previous_version_id;

  return query select 'restored'::text, v_previous_version_id;
end;
$$;

revoke all on function public.discard_survey_draft(uuid, uuid, uuid) from public;
revoke all on function public.discard_survey_draft(uuid, uuid, uuid) from anon;
revoke all on function public.discard_survey_draft(uuid, uuid, uuid) from authenticated;
grant execute on function public.discard_survey_draft(uuid, uuid, uuid) to service_role;
