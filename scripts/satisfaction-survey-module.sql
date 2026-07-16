-- Satisfaction survey builder, anonymous collection, aggregates, and KPI publication.
-- Apply manually in Supabase SQL Editor after reviewing against the target environment.

create schema if not exists private;

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  archived_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.survey_versions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  title text not null,
  description text,
  published_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (survey_id, version_number)
);

create unique index if not exists survey_versions_one_draft_per_survey
  on public.survey_versions (survey_id) where status = 'draft';

create table if not exists public.survey_sections (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
  section_key text not null,
  title text not null,
  description text,
  sort_order integer not null check (sort_order > 0),
  unique (survey_version_id, section_key),
  unique (survey_version_id, sort_order)
);

create table if not exists public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
  survey_section_id uuid not null references public.survey_sections(id) on delete cascade,
  question_key text not null,
  prompt text not null,
  question_type text not null check (question_type in (
    'single_choice', 'short_text', 'number', 'rating_scale', 'long_text', 'yes_no'
  )),
  required boolean not null default false,
  help_text text,
  placeholder text,
  sort_order integer not null check (sort_order > 0),
  numeric_min numeric,
  numeric_max numeric,
  text_max_length integer,
  positive_threshold numeric,
  allow_detail_text boolean not null default false,
  detail_label text,
  is_comment boolean not null default false,
  check (numeric_min is null or numeric_max is null or numeric_min <= numeric_max),
  check (text_max_length is null or text_max_length between 1 and 4000),
  unique (survey_version_id, question_key),
  unique (survey_section_id, sort_order)
);

create table if not exists public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
  survey_question_id uuid not null references public.survey_questions(id) on delete cascade,
  option_key text not null,
  label text not null,
  value text not null,
  score numeric,
  allows_other_text boolean not null default false,
  sort_order integer not null check (sort_order > 0),
  unique (survey_question_id, option_key),
  unique (survey_question_id, sort_order)
);

create table if not exists public.survey_campaigns (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete restrict,
  survey_version_id uuid not null references public.survey_versions(id) on delete restrict,
  name text not null,
  public_token text not null unique check (length(public_token) >= 32),
  status text not null default 'draft' check (status in ('draft', 'open', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  response_limit integer check (response_limit is null or response_limit > 0),
  response_count integer not null default 0 check (response_count >= 0),
  one_per_device boolean not null default false,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (opens_at is null or closes_at is null or opens_at < closes_at)
);

create index if not exists survey_campaigns_version_idx
  on public.survey_campaigns (survey_version_id, status);

create table if not exists public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id) on delete restrict,
  survey_version_id uuid not null references public.survey_versions(id) on delete restrict,
  submission_key uuid not null,
  submitted_at timestamptz not null default now(),
  unique (campaign_id, submission_key)
);

create index if not exists survey_responses_campaign_submitted_idx
  on public.survey_responses (campaign_id, submitted_at desc);

create table if not exists public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  campaign_id uuid not null references public.survey_campaigns(id) on delete restrict,
  survey_version_id uuid not null references public.survey_versions(id) on delete restrict,
  survey_section_id uuid not null references public.survey_sections(id) on delete restrict,
  survey_question_id uuid not null references public.survey_questions(id) on delete restrict,
  survey_option_id uuid references public.survey_question_options(id) on delete restrict,
  numeric_value numeric,
  text_value text check (text_value is null or char_length(text_value) <= 4000),
  detail_text text check (detail_text is null or char_length(detail_text) <= 500),
  score numeric,
  max_score numeric,
  positive_threshold numeric,
  is_comment boolean not null default false,
  comment_read_at timestamptz,
  comment_read_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (response_id, survey_question_id)
);

create index if not exists survey_answers_campaign_question_idx
  on public.survey_answers (campaign_id, survey_question_id);
create index if not exists survey_answers_unread_comments_idx
  on public.survey_answers (campaign_id, created_at desc)
  where is_comment and text_value is not null and comment_read_at is null;

create table if not exists public.survey_response_devices (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id) on delete cascade,
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  device_hash text not null check (length(device_hash) between 32 and 128),
  created_at timestamptz not null default now(),
  unique (campaign_id, device_hash),
  unique (response_id)
);

create table if not exists public.survey_response_events (
  id bigint generated always as identity primary key,
  campaign_id uuid not null references public.survey_campaigns(id) on delete cascade,
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  unique (response_id)
);

create index if not exists survey_response_events_campaign_idx
  on public.survey_response_events (campaign_id, occurred_at desc);

create table if not exists public.survey_kpi_publications (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.survey_campaigns(id) on delete restrict,
  survey_version_id uuid not null references public.survey_versions(id) on delete restrict,
  fiscal_year integer not null check (fiscal_year between 2500 and 3000),
  metric_code text not null,
  normalized_pct numeric not null check (normalized_pct between 0 and 100),
  positive_pct numeric check (positive_pct between 0 and 100),
  response_count integer not null check (response_count >= 0),
  formula text not null,
  published_by uuid references public.profiles(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (campaign_id),
  unique (metric_code, fiscal_year)
);

alter table public.surveys enable row level security;
alter table public.survey_versions enable row level security;
alter table public.survey_sections enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_question_options enable row level security;
alter table public.survey_campaigns enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;
alter table public.survey_response_devices enable row level security;
alter table public.survey_response_events enable row level security;
alter table public.survey_kpi_publications enable row level security;

revoke all on table public.surveys from anon, authenticated;
revoke all on table public.survey_versions from anon, authenticated;
revoke all on table public.survey_sections from anon, authenticated;
revoke all on table public.survey_questions from anon, authenticated;
revoke all on table public.survey_question_options from anon, authenticated;
revoke all on table public.survey_campaigns from anon, authenticated;
revoke all on table public.survey_responses from anon, authenticated;
revoke all on table public.survey_answers from anon, authenticated;
revoke all on table public.survey_response_devices from anon, authenticated;
revoke all on table public.survey_response_events from anon, authenticated;
revoke all on table public.survey_kpi_publications from anon, authenticated;

grant all on table public.surveys to service_role;
grant all on table public.survey_versions to service_role;
grant all on table public.survey_sections to service_role;
grant all on table public.survey_questions to service_role;
grant all on table public.survey_question_options to service_role;
grant all on table public.survey_campaigns to service_role;
grant all on table public.survey_responses to service_role;
grant all on table public.survey_answers to service_role;
grant all on table public.survey_response_devices to service_role;
grant all on table public.survey_response_events to service_role;
grant all on table public.survey_kpi_publications to service_role;
grant usage, select on sequence public.survey_response_events_id_seq to service_role;

-- Realtime subscribers receive only a tiny response event, never an answer or comment.
grant select on table public.survey_response_events to authenticated;
drop policy if exists survey_response_events_staff_read on public.survey_response_events;
create policy survey_response_events_staff_read
  on public.survey_response_events for select to authenticated
  using (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          lower(p.role) = 'admin'
          or exists (
            select 1 from public.role_permissions rp
            where lower(rp.role) = lower(p.role)
              and rp.granted = true
              and rp.resource in (
                'แบบสำรวจความพึงพอใจ:view',
                'แบบสำรวจความพึงพอใจ:edit'
              )
          )
        )
    )
  );

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'survey_response_events'
  ) then
    alter publication supabase_realtime add table public.survey_response_events;
  end if;
end $$;

create or replace function private.prevent_published_survey_version_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'published' then
    raise exception 'Published survey versions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_published_survey_version_changes on public.survey_versions;
create trigger prevent_published_survey_version_changes
before update or delete on public.survey_versions
for each row execute function private.prevent_published_survey_version_changes();

create or replace function private.prevent_published_survey_definition_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_version_id uuid;
begin
  if tg_op = 'DELETE' then
    target_version_id := old.survey_version_id;
  else
    target_version_id := new.survey_version_id;
  end if;
  if exists (
    select 1 from public.survey_versions
    where id = target_version_id and status = 'published'
  ) then
    raise exception 'Published survey definitions are immutable';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_published_sections_changes on public.survey_sections;
create trigger prevent_published_sections_changes before insert or update or delete
on public.survey_sections for each row execute function private.prevent_published_survey_definition_changes();
drop trigger if exists prevent_published_questions_changes on public.survey_questions;
create trigger prevent_published_questions_changes before insert or update or delete
on public.survey_questions for each row execute function private.prevent_published_survey_definition_changes();
drop trigger if exists prevent_published_options_changes on public.survey_question_options;
create trigger prevent_published_options_changes before insert or update or delete
on public.survey_question_options for each row execute function private.prevent_published_survey_definition_changes();

create or replace function public.submit_survey_response(
  p_campaign_token text,
  p_submission_key uuid,
  p_device_hash text,
  p_answers jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_campaign public.survey_campaigns%rowtype;
  v_existing_response_id uuid;
  v_response_id uuid := gen_random_uuid();
  v_answer jsonb;
  v_question public.survey_questions%rowtype;
  v_option public.survey_question_options%rowtype;
begin
  if p_submission_key is null or jsonb_typeof(p_answers) <> 'array' then
    raise exception 'Invalid submission payload';
  end if;

  select * into v_campaign
  from public.survey_campaigns
  where public_token = p_campaign_token
  for update;

  if not found then raise exception 'Campaign not found'; end if;

  select id into v_existing_response_id
  from public.survey_responses
  where campaign_id = v_campaign.id and submission_key = p_submission_key;
  if v_existing_response_id is not null then return v_existing_response_id; end if;

  if v_campaign.status <> 'open'
    or (v_campaign.opens_at is not null and v_campaign.opens_at > now())
    or (v_campaign.closes_at is not null and v_campaign.closes_at <= now()) then
    raise exception 'Campaign is not open';
  end if;
  if v_campaign.response_limit is not null and v_campaign.response_count >= v_campaign.response_limit then
    raise exception 'Campaign response limit reached';
  end if;
  if v_campaign.one_per_device and (p_device_hash is null or length(p_device_hash) < 32) then
    raise exception 'Device hash is required';
  end if;
  if not exists (
    select 1 from public.survey_versions
    where id = v_campaign.survey_version_id and status = 'published'
  ) then
    raise exception 'Campaign version is not published';
  end if;

  insert into public.survey_responses (id, campaign_id, survey_version_id, submission_key)
  values (v_response_id, v_campaign.id, v_campaign.survey_version_id, p_submission_key);

  if v_campaign.one_per_device then
    insert into public.survey_response_devices (campaign_id, response_id, device_hash)
    values (v_campaign.id, v_response_id, p_device_hash);
  end if;

  for v_answer in select value from jsonb_array_elements(p_answers)
  loop
    select * into v_question
    from public.survey_questions
    where id = (v_answer->>'questionId')::uuid
      and survey_version_id = v_campaign.survey_version_id;
    if not found then raise exception 'Answer contains an invalid question'; end if;

    v_option := null;
    if nullif(v_answer->>'optionId', '') is not null then
      select * into v_option
      from public.survey_question_options
      where id = (v_answer->>'optionId')::uuid
        and survey_question_id = v_question.id;
      if not found then raise exception 'Answer contains an invalid option'; end if;
    end if;

    insert into public.survey_answers (
      response_id, campaign_id, survey_version_id, survey_section_id,
      survey_question_id, survey_option_id, numeric_value, text_value, detail_text,
      score, max_score, positive_threshold, is_comment
    ) values (
      v_response_id, v_campaign.id, v_campaign.survey_version_id, v_question.survey_section_id,
      v_question.id, v_option.id, nullif(v_answer->>'numericValue', '')::numeric,
      nullif(v_answer->>'textValue', ''), nullif(v_answer->>'detailText', ''),
      nullif(v_answer->>'score', '')::numeric, nullif(v_answer->>'maxScore', '')::numeric,
      nullif(v_answer->>'positiveThreshold', '')::numeric, v_question.is_comment
    );
  end loop;

  if exists (
    select 1 from public.survey_questions q
    where q.survey_version_id = v_campaign.survey_version_id and q.required
      and not exists (
        select 1 from public.survey_answers a
        where a.response_id = v_response_id and a.survey_question_id = q.id
      )
  ) then
    raise exception 'Required answers are missing';
  end if;

  update public.survey_campaigns
  set response_count = response_count + 1, updated_at = now()
  where id = v_campaign.id;
  insert into public.survey_response_events (campaign_id, response_id)
  values (v_campaign.id, v_response_id);

  return v_response_id;
end;
$$;

revoke all on function public.submit_survey_response(text, uuid, text, jsonb) from public;
revoke all on function public.submit_survey_response(text, uuid, text, jsonb) from anon;
revoke all on function public.submit_survey_response(text, uuid, text, jsonb) from authenticated;
grant execute on function public.submit_survey_response(text, uuid, text, jsonb) to service_role;

-- Replaces the complete draft graph inside one transaction. Published versions cannot match.
create or replace function public.save_survey_draft(
  p_survey_id uuid,
  p_definition jsonb,
  p_actor_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid := (p_definition->>'id')::uuid;
  v_section jsonb;
  v_question jsonb;
  v_option jsonb;
  v_section_id uuid;
  v_question_id uuid;
begin
  if pg_column_size(p_definition) > 1048576 then
    raise exception 'Survey definition is too large';
  end if;
  perform 1 from public.survey_versions
  where id = v_version_id and survey_id = p_survey_id and status = 'draft'
  for update;
  if not found then raise exception 'Draft survey version not found'; end if;

  update public.survey_versions set
    title = left(p_definition->>'title', 500),
    description = left(p_definition->>'description', 4000),
    updated_at = now()
  where id = v_version_id;
  update public.surveys set
    title = left(p_definition->>'title', 500),
    description = left(p_definition->>'description', 4000),
    updated_at = now()
  where id = p_survey_id;

  delete from public.survey_sections where survey_version_id = v_version_id;
  for v_section in select value from jsonb_array_elements(p_definition->'sections')
  loop
    v_section_id := (v_section->>'id')::uuid;
    insert into public.survey_sections (
      id, survey_version_id, section_key, title, description, sort_order
    ) values (
      v_section_id, v_version_id, v_section->>'sectionKey', left(v_section->>'title', 500),
      left(v_section->>'description', 2000), (v_section->>'sortOrder')::integer
    );

    for v_question in select value from jsonb_array_elements(v_section->'questions')
    loop
      v_question_id := (v_question->>'id')::uuid;
      insert into public.survey_questions (
        id, survey_version_id, survey_section_id, question_key, prompt, question_type,
        required, help_text, placeholder, sort_order, numeric_min, numeric_max,
        text_max_length, positive_threshold, allow_detail_text, detail_label, is_comment
      ) values (
        v_question_id, v_version_id, v_section_id, v_question->>'questionKey',
        left(v_question->>'prompt', 1000), v_question->>'type',
        coalesce((v_question->>'required')::boolean, false), left(v_question->>'helpText', 1000),
        left(v_question->>'placeholder', 500), (v_question->>'sortOrder')::integer,
        (v_question->>'min')::numeric, (v_question->>'max')::numeric,
        (v_question->>'maxLength')::integer, (v_question->>'positiveThreshold')::numeric,
        coalesce((v_question->>'allowDetailText')::boolean, false),
        left(v_question->>'detailLabel', 500), coalesce((v_question->>'isComment')::boolean, false)
      );

      if jsonb_typeof(v_question->'options') = 'array' then
        for v_option in select value from jsonb_array_elements(v_question->'options')
        loop
          insert into public.survey_question_options (
            id, survey_version_id, survey_question_id, option_key, label, value,
            score, allows_other_text, sort_order
          ) values (
            (v_option->>'id')::uuid, v_version_id, v_question_id, v_option->>'optionKey',
            left(v_option->>'label', 500), left(v_option->>'value', 500),
            (v_option->>'score')::numeric,
            coalesce((v_option->>'allowsOtherText')::boolean, false),
            (v_option->>'sortOrder')::integer
          );
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

revoke all on function public.save_survey_draft(uuid, jsonb, uuid) from public;
revoke all on function public.save_survey_draft(uuid, jsonb, uuid) from anon;
revoke all on function public.save_survey_draft(uuid, jsonb, uuid) from authenticated;
grant execute on function public.save_survey_draft(uuid, jsonb, uuid) to service_role;

-- Discards only the active draft. A prior published version remains untouched;
-- a survey with no published version is archived so it can be retained without
-- appearing as an incomplete active survey.
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

-- Publishes a closed campaign to the legacy annual KPI table atomically.
create or replace function public.publish_survey_kpi(
  p_campaign_id uuid,
  p_fiscal_year integer,
  p_metric_code text,
  p_metric_name text,
  p_normalized_pct numeric,
  p_positive_pct numeric,
  p_response_count integer,
  p_formula text,
  p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_id uuid;
  v_publication_id uuid := gen_random_uuid();
begin
  select survey_version_id into v_version_id
  from public.survey_campaigns
  where id = p_campaign_id and status = 'closed'
  for update;
  if not found then raise exception 'Campaign must be closed'; end if;
  if exists (select 1 from public.survey_kpi_publications where campaign_id = p_campaign_id) then
    raise exception 'Campaign was already published';
  end if;
  if exists (
    select 1 from public.kpi_satisfaction
    where metric_code = p_metric_code and fiscal_year = p_fiscal_year
  ) then raise exception 'KPI metric/year already exists'; end if;

  insert into public.survey_kpi_publications (
    id, campaign_id, survey_version_id, fiscal_year, metric_code,
    normalized_pct, positive_pct, response_count, formula, published_by
  ) values (
    v_publication_id, p_campaign_id, v_version_id, p_fiscal_year, p_metric_code,
    p_normalized_pct, p_positive_pct, p_response_count, p_formula, p_actor_id
  );
  insert into public.kpi_satisfaction (
    metric_code, metric_name, fiscal_year, value
  ) values (
    p_metric_code, p_metric_name, p_fiscal_year, p_normalized_pct
  );
  return v_publication_id;
end;
$$;

revoke all on function public.publish_survey_kpi(uuid, integer, text, text, numeric, numeric, integer, text, uuid) from public;
revoke all on function public.publish_survey_kpi(uuid, integer, text, text, numeric, numeric, integer, text, uuid) from anon;
revoke all on function public.publish_survey_kpi(uuid, integer, text, text, numeric, numeric, integer, text, uuid) from authenticated;
grant execute on function public.publish_survey_kpi(uuid, integer, text, text, numeric, numeric, integer, text, uuid) to service_role;

-- Seed helper accepts the reviewed form as JSON and creates immutable Published Version 1.
create or replace function private.seed_satisfaction_survey(
  p_code text,
  p_title text,
  p_definition jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survey_id uuid;
  v_version_id uuid;
  v_section jsonb;
  v_question jsonb;
  v_option jsonb;
  v_section_id uuid;
  v_question_id uuid;
  v_section_order integer := 0;
  v_question_order integer;
  v_option_order integer;
begin
  insert into public.surveys (code, title)
  values (p_code, p_title)
  on conflict (code) do update set title = excluded.title
  returning id into v_survey_id;

  if exists (
    select 1 from public.survey_versions
    where survey_id = v_survey_id and version_number = 1
  ) then return; end if;

  insert into public.survey_versions (
    survey_id, version_number, status, title, description, published_at
  ) values (
    v_survey_id, 1, 'draft', p_title, p_definition->>'description', null
  ) returning id into v_version_id;

  for v_section in select value from jsonb_array_elements(p_definition->'sections')
  loop
    v_section_order := v_section_order + 1;
    insert into public.survey_sections (
      survey_version_id, section_key, title, description, sort_order
    ) values (
      v_version_id, v_section->>'key', v_section->>'title', v_section->>'description', v_section_order
    ) returning id into v_section_id;

    v_question_order := 0;
    for v_question in select value from jsonb_array_elements(v_section->'questions')
    loop
      v_question_order := v_question_order + 1;
      insert into public.survey_questions (
        survey_version_id, survey_section_id, question_key, prompt, question_type,
        required, sort_order, numeric_min, numeric_max, text_max_length,
        positive_threshold, allow_detail_text, detail_label, is_comment
      ) values (
        v_version_id, v_section_id, v_question->>'key', v_question->>'prompt', v_question->>'type',
        coalesce((v_question->>'required')::boolean, false), v_question_order,
        (v_question->>'min')::numeric, (v_question->>'max')::numeric,
        (v_question->>'max_length')::integer,
        case when v_question->>'type' = 'rating_scale'
          then coalesce((v_question->>'positive_threshold')::numeric, 4) end,
        coalesce((v_question->>'allow_detail')::boolean, false),
        v_question->>'detail_label', coalesce((v_question->>'comment')::boolean, false)
      ) returning id into v_question_id;

      v_option_order := 0;
      if v_question->>'type' = 'rating_scale' then
        for v_option_order in 1..5 loop
          insert into public.survey_question_options (
            survey_version_id, survey_question_id, option_key, label, value, score, sort_order
          ) values (
            v_version_id, v_question_id, 'score_' || v_option_order,
            case v_option_order when 1 then 'น้อยที่สุด' when 2 then 'น้อย'
              when 3 then 'ปานกลาง' when 4 then 'มาก' else 'มากที่สุด' end,
            v_option_order::text, v_option_order, v_option_order
          );
        end loop;
      elsif v_question->>'type' = 'yes_no' then
        insert into public.survey_question_options
          (survey_version_id, survey_question_id, option_key, label, value, sort_order)
        values
          (v_version_id, v_question_id, 'yes', 'ใช่', 'yes', 1),
          (v_version_id, v_question_id, 'no', 'ไม่ใช่', 'no', 2);
      elsif jsonb_typeof(v_question->'options') = 'array' then
        for v_option in select value from jsonb_array_elements(v_question->'options')
        loop
          v_option_order := v_option_order + 1;
          insert into public.survey_question_options (
            survey_version_id, survey_question_id, option_key, label, value,
            score, allows_other_text, sort_order
          ) values (
            v_version_id, v_question_id, v_option->>'key', v_option->>'label',
            coalesce(v_option->>'value', v_option->>'key'), (v_option->>'score')::numeric,
            coalesce((v_option->>'other')::boolean, false), v_option_order
          );
        end loop;
      end if;
    end loop;
  end loop;

  update public.survey_versions
  set status = 'published', published_at = now(), updated_at = now()
  where id = v_version_id;
end;
$$;

-- SEED FM-QP-LAB-09-01
select private.seed_satisfaction_survey(
  'FM-QP-LAB-09-01',
  'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะบริการด่านหน้า)',
  $json${
    "description":"สำหรับผู้รับบริการเจาะเลือดและบริการด่านหน้า",
    "sections":[
      {"key":"profile","title":"ข้อมูลทั่วไป","questions":[
        {"key":"sex","prompt":"เพศ","type":"single_choice","required":false,"options":[{"key":"male","label":"ชาย"},{"key":"female","label":"หญิง"},{"key":"other","label":"อื่น ๆ","other":true}]},
        {"key":"age_range","prompt":"ช่วงอายุ","type":"single_choice","required":false,"options":[{"key":"under20","label":"ต่ำกว่า 20 ปี"},{"key":"20_39","label":"20–39 ปี"},{"key":"40_59","label":"40–59 ปี"},{"key":"60plus","label":"60 ปีขึ้นไป"}]},
        {"key":"payment","prompt":"สิทธิการรักษา/การชำระค่าบริการ","type":"single_choice","required":false,"options":[{"key":"uc","label":"หลักประกันสุขภาพ"},{"key":"civil","label":"ข้าราชการ"},{"key":"social","label":"ประกันสังคม"},{"key":"self","label":"ชำระเงินเอง"},{"key":"other","label":"อื่น ๆ","other":true}]}
      ]},
      {"key":"service","title":"ความพึงพอใจต่อบริการ","questions":[
        {"key":"q01","prompt":"สถานที่ให้บริการสะอาดและเป็นระเบียบ","type":"rating_scale","required":true},
        {"key":"q02","prompt":"ป้ายและขั้นตอนการรับบริการเข้าใจง่าย","type":"rating_scale","required":true},
        {"key":"q03","prompt":"ระยะเวลารอรับบริการเหมาะสม","type":"rating_scale","required":true},
        {"key":"q04","prompt":"เจ้าหน้าที่ให้บริการด้วยความสุภาพ","type":"rating_scale","required":true},
        {"key":"q05","prompt":"เจ้าหน้าที่ให้ข้อมูลชัดเจน","type":"rating_scale","required":true},
        {"key":"q06","prompt":"เจ้าหน้าที่เอาใจใส่และเต็มใจให้บริการ","type":"rating_scale","required":true},
        {"key":"q07","prompt":"ขั้นตอนการเจาะเลือดมีความปลอดภัย","type":"rating_scale","required":true},
        {"key":"q08","prompt":"ได้รับบริการตรงตามความต้องการ","type":"rating_scale","required":true},
        {"key":"q09","prompt":"ความสะดวกในการเข้าถึงบริการ","type":"rating_scale","required":true},
        {"key":"q10","prompt":"ความเชื่อมั่นต่อคุณภาพบริการ","type":"rating_scale","required":true},
        {"key":"q11","prompt":"ความพึงพอใจด้านอื่น ๆ","type":"rating_scale","required":false,"allow_detail":true,"detail_label":"โปรดระบุ"}
      ]},
      {"key":"comment","title":"ข้อเสนอแนะ","questions":[
        {"key":"comment","prompt":"ความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม","type":"long_text","required":false,"comment":true,"max_length":4000}
      ]}
    ]
  }$json$::jsonb
);
-- END SEED

-- SEED FM-QP-LAB-09-02
select private.seed_satisfaction_survey(
  'FM-QP-LAB-09-02',
  'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะแพทย์ ทันตแพทย์ และพยาบาล)',
  $json${"sections":[
    {"key":"profile","title":"ข้อมูลผู้ตอบ","questions":[
      {"key":"profession","prompt":"วิชาชีพ","type":"single_choice","required":true,"options":[{"key":"doctor","label":"แพทย์"},{"key":"dentist","label":"ทันตแพทย์"},{"key":"nurse","label":"พยาบาล"}]},
      {"key":"department","prompt":"หน่วยงาน/หอผู้ป่วย","type":"short_text","required":false,"max_length":500}
    ]},
    {"key":"service","title":"ความพึงพอใจต่อบริการ","questions":[
      {"key":"q01","prompt":"ความสะดวกในการส่งตรวจทางห้องปฏิบัติการ","type":"rating_scale","required":true},
      {"key":"q02","prompt":"ความชัดเจนของข้อมูลการให้บริการ","type":"rating_scale","required":true},
      {"key":"q03","prompt":"ความครบถ้วนของรายการตรวจ","type":"rating_scale","required":true},
      {"key":"q04","prompt":"ความถูกต้องและน่าเชื่อถือของผลตรวจ","type":"rating_scale","required":true},
      {"key":"q05","prompt":"ระยะเวลาในการรายงานผลตรวจ","type":"rating_scale","required":true},
      {"key":"q06","prompt":"การแจ้งผลค่าวิกฤตเหมาะสม","type":"rating_scale","required":true},
      {"key":"q07","prompt":"การให้คำปรึกษาของเจ้าหน้าที่","type":"rating_scale","required":true},
      {"key":"q08","prompt":"ความสุภาพและเต็มใจให้บริการ","type":"rating_scale","required":true},
      {"key":"q09","prompt":"ความพึงพอใจโดยรวม","type":"rating_scale","required":true}
    ]},
    {"key":"comment","title":"ข้อเสนอแนะ","questions":[{"key":"comment","prompt":"ความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม","type":"long_text","required":false,"comment":true,"max_length":4000}]}
  ]}$json$::jsonb
);
-- END SEED

-- SEED FM-QP-LAB-09-03
select private.seed_satisfaction_survey(
  'FM-QP-LAB-09-03',
  'แบบสำรวจความพึงพอใจต่อการให้บริการ (เฉพาะเจ้าหน้าที่ส่งตรวจ-เสมียนหอ)',
  $json${"sections":[
    {"key":"profile","title":"ข้อมูลผู้ตอบ","questions":[
      {"key":"department","prompt":"หน่วยงาน/หอผู้ป่วย","type":"short_text","required":false,"max_length":500}
    ]},
    {"key":"service","title":"ความพึงพอใจต่อบริการ","questions":[
      {"key":"q01","prompt":"ขั้นตอนการรับสิ่งส่งตรวจสะดวกและชัดเจน","type":"rating_scale","required":true},
      {"key":"q02","prompt":"เจ้าหน้าที่รับสิ่งส่งตรวจให้บริการสุภาพ","type":"rating_scale","required":true},
      {"key":"q03","prompt":"การประสานงานเมื่อสิ่งส่งตรวจไม่ถูกต้อง","type":"rating_scale","required":true},
      {"key":"q04","prompt":"ระยะเวลารอส่งสิ่งส่งตรวจเหมาะสม","type":"rating_scale","required":true},
      {"key":"q05","prompt":"ข้อมูลและคำแนะนำมีความชัดเจน","type":"rating_scale","required":true},
      {"key":"q06","prompt":"ความพึงพอใจโดยรวม","type":"rating_scale","required":true}
    ]},
    {"key":"comment","title":"ข้อเสนอแนะ","questions":[{"key":"comment","prompt":"ความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม","type":"long_text","required":false,"comment":true,"max_length":4000}]}
  ]}$json$::jsonb
);
-- END SEED

-- SEED FM-QP-LAB-09-04
select private.seed_satisfaction_survey(
  'FM-QP-LAB-09-04',
  'แบบประเมินความพึงพอใจของผู้บริจาคโลหิต',
  $json${"sections":[
    {"key":"profile","title":"ข้อมูลทั่วไป","questions":[
      {"key":"sex","prompt":"เพศ","type":"single_choice","required":false,"options":[{"key":"male","label":"ชาย"},{"key":"female","label":"หญิง"},{"key":"other","label":"อื่น ๆ","other":true}]},
      {"key":"age","prompt":"อายุ (ปี)","type":"number","required":false,"min":17,"max":100},
      {"key":"education","prompt":"ระดับการศึกษา","type":"single_choice","required":false,"options":[{"key":"primary","label":"ประถมศึกษา"},{"key":"secondary","label":"มัธยมศึกษา"},{"key":"diploma","label":"อนุปริญญา"},{"key":"bachelor","label":"ปริญญาตรี"},{"key":"higher","label":"สูงกว่าปริญญาตรี"}]},
      {"key":"occupation","prompt":"อาชีพ","type":"short_text","required":false,"max_length":500},
      {"key":"purpose","prompt":"วัตถุประสงค์ในการบริจาคโลหิต","type":"single_choice","required":false,"options":[{"key":"voluntary","label":"บริจาคโดยสมัครใจ"},{"key":"replacement","label":"บริจาคทดแทน"},{"key":"other","label":"อื่น ๆ","other":true}]},
      {"key":"history","prompt":"ประวัติการบริจาคโลหิต","type":"single_choice","required":false,"options":[{"key":"first","label":"ครั้งแรก"},{"key":"repeat","label":"เคยบริจาคแล้ว"}]}
    ]},
    {"key":"place","title":"ด้านสถานที่และสิ่งอำนวยความสะดวก","questions":[
      {"key":"q01","prompt":"สถานที่รับบริจาคสะอาดและเป็นระเบียบ","type":"rating_scale","required":true},
      {"key":"q02","prompt":"สถานที่นั่งรอเพียงพอและเหมาะสม","type":"rating_scale","required":true},
      {"key":"q03","prompt":"ป้ายแนะนำขั้นตอนชัดเจน","type":"rating_scale","required":true},
      {"key":"q04","prompt":"อุปกรณ์และพื้นที่ให้ความรู้สึกปลอดภัย","type":"rating_scale","required":true}
    ]},
    {"key":"staff","title":"ด้านเจ้าหน้าที่","questions":[
      {"key":"q05","prompt":"เจ้าหน้าที่ให้บริการสุภาพและเป็นมิตร","type":"rating_scale","required":true},
      {"key":"q06","prompt":"เจ้าหน้าที่ให้ข้อมูลก่อนบริจาคชัดเจน","type":"rating_scale","required":true},
      {"key":"q07","prompt":"เจ้าหน้าที่ตอบข้อสงสัยได้ชัดเจน","type":"rating_scale","required":true},
      {"key":"q08","prompt":"เจ้าหน้าที่เอาใจใส่ระหว่างบริจาค","type":"rating_scale","required":true},
      {"key":"q09","prompt":"เจ้าหน้าที่ดูแลหลังบริจาคเหมาะสม","type":"rating_scale","required":true}
    ]},
    {"key":"process","title":"ด้านกระบวนการให้บริการ","questions":[
      {"key":"q10","prompt":"ขั้นตอนลงทะเบียนสะดวก","type":"rating_scale","required":true},
      {"key":"q11","prompt":"ขั้นตอนคัดกรองมีความเหมาะสม","type":"rating_scale","required":true},
      {"key":"q12","prompt":"ระยะเวลารอคอยเหมาะสม","type":"rating_scale","required":true},
      {"key":"q13","prompt":"กระบวนการบริจาคโลหิตมีความปลอดภัย","type":"rating_scale","required":true},
      {"key":"q14","prompt":"อาหารว่างและการพักฟื้นเหมาะสม","type":"rating_scale","required":true},
      {"key":"q15","prompt":"ความพึงพอใจโดยรวม","type":"rating_scale","required":true}
    ]},
    {"key":"followup","title":"ข้อเสนอแนะและการกลับมาใช้บริการ","questions":[
      {"key":"improvement","prompt":"เรื่องที่ควรปรับปรุงเร่งด่วน","type":"long_text","required":false,"comment":true,"max_length":4000},
      {"key":"return","prompt":"ท่านตั้งใจจะกลับมาบริจาคโลหิตอีกหรือไม่","type":"yes_no","required":false}
    ]}
  ]}$json$::jsonb
);
-- END SEED

-- Permission defaults use the repository's resource:level suffix convention.
insert into public.role_permissions (role, resource, granted) values
  ('Manager', 'แบบสำรวจความพึงพอใจ:edit', true),
  ('Medical Technologist', 'แบบสำรวจความพึงพอใจ:view', true),
  ('Medical Science Technician', 'แบบสำรวจความพึงพอใจ:view', true),
  ('Assistant', 'แบบสำรวจความพึงพอใจ:view', true)
on conflict (role, resource) do update set granted = excluded.granted;

revoke all on function private.seed_satisfaction_survey(text, text, jsonb) from public, anon, authenticated;
revoke all on function private.prevent_published_survey_version_changes() from public, anon, authenticated;
revoke all on function private.prevent_published_survey_definition_changes() from public, anon, authenticated;
