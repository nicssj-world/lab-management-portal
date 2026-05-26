-- Risk management module for /staff/risk
-- Extends the existing risks table and adds action/follow-up tracking.

alter table risks add column if not exists risk_no text;
alter table risks add column if not exists external_no text;
alter table risks add column if not exists event_type text default 'incident';
alter table risks add column if not exists event_date date;
alter table risks add column if not exists event_time time;
alter table risks add column if not exists reporter_name text;
alter table risks add column if not exists reporter_position text;
alter table risks add column if not exists department_found text;
alter table risks add column if not exists department_target text;
alter table risks add column if not exists risk_type text;
alter table risks add column if not exists event_main_category text;
alter table risks add column if not exists event_sub_category text;
alter table risks add column if not exists event_category text;
alter table risks add column if not exists event_detail text;
alter table risks add column if not exists impact_summary text;
alter table risks add column if not exists immediate_correction text;
alter table risks add column if not exists evidence_note text;
alter table risks add column if not exists severity_level text;
alter table risks add column if not exists ior_status text;
alter table risks add column if not exists recorded_date date;
alter table risks add column if not exists requires_rca boolean default false;
alter table risks add column if not exists review_status text default 'pending';
alter table risks add column if not exists reviewed_by text;
alter table risks add column if not exists reviewed_at timestamptz;
alter table risks add column if not exists review_note text;
alter table risks add column if not exists rca_method text;
alter table risks add column if not exists root_cause text;
alter table risks add column if not exists rca_factors jsonb default '{}'::jsonb;
alter table risks add column if not exists residual_likelihood int check (residual_likelihood between 1 and 5);
alter table risks add column if not exists residual_impact int check (residual_impact between 1 and 5);
alter table risks add column if not exists residual_score int;
alter table risks add column if not exists residual_level text check (residual_level in ('low','medium','high'));
alter table risks add column if not exists residual_assessed_at timestamptz;
alter table risks add column if not exists residual_assessed_by text;
alter table risks add column if not exists risk_accepted_by text;
alter table risks add column if not exists risk_accepted_at timestamptz;
alter table risks add column if not exists due_date date;
alter table risks add column if not exists follow_up_date date;
alter table risks add column if not exists effectiveness_result text;
alter table risks add column if not exists closed_by text;
alter table risks add column if not exists closed_at timestamptz;
alter table risks add column if not exists created_by uuid references profiles(id);
alter table risks add column if not exists updated_at timestamptz default now();

alter table risks drop constraint if exists risks_status_check;
alter table risks add constraint risks_status_check
  check (status in ('open','mitigating','monitoring','closed'));

alter table risks drop constraint if exists risks_level_check;
alter table risks add constraint risks_level_check
  check (level in ('low','medium','high'));

alter table risks drop constraint if exists risks_review_status_check;
alter table risks add constraint risks_review_status_check
  check (review_status in ('pending','reviewed','rca_required','action_plan','follow_up','closed'));

create unique index if not exists idx_risks_external_no_unique
  on risks (external_no)
  where external_no is not null and external_no <> '';

create index if not exists idx_risks_event_date on risks (event_date);
create index if not exists idx_risks_status on risks (status);
create index if not exists idx_risks_severity_level on risks (severity_level);
create index if not exists idx_risks_residual_level on risks (residual_level);

create table if not exists risk_actions (
  id bigint generated always as identity primary key,
  risk_id bigint not null references risks(id) on delete cascade,
  action_type text not null check (action_type in ('correction','corrective','preventive','follow_up')),
  description text not null,
  owner text,
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  completed_at timestamptz,
  evidence text,
  effectiveness_note text,
  follow_up_date date,
  followed_by text,
  result text,
  is_effective boolean,
  next_follow_up_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_risk_actions_risk_id on risk_actions (risk_id);
create index if not exists idx_risk_actions_due_date on risk_actions (due_date);
create index if not exists idx_risk_actions_status on risk_actions (status);

alter table risk_actions enable row level security;

drop policy if exists "risk_actions_auth_read" on risk_actions;
create policy "risk_actions_auth_read" on risk_actions for select
  using (auth.role() != 'anon');

drop policy if exists "risk_actions_admin_manager_write" on risk_actions;
create policy "risk_actions_admin_manager_write" on risk_actions for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('Admin','Manager')
    )
  )
  with check (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
        and p.role in ('Admin','Manager')
    )
  );
