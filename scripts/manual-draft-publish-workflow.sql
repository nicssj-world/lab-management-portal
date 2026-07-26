-- Controlled online-manual draft/publish workflow.
-- Run after scripts/manual-web-source-of-truth.sql.
-- A draft is visible only to the editor; only Publish creates a section version,
-- updates the manual review date, and records public revision history.

create table if not exists public.manual_section_drafts (
  section_id text primary key references public.manual_sections(id) on delete cascade,
  body_html_th text not null default '',
  body_html_en text not null default '',
  table_data jsonb,
  owner_name_th text,
  owner_name_en text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.manual_section_drafts enable row level security;

-- Existing content starts as a draft identical to the published version. This
-- does not make it an unpublished change and allows the first edit to merge safely.
insert into public.manual_section_drafts (
  section_id, body_html_th, body_html_en, table_data,
  owner_name_th, owner_name_en, updated_at, updated_by
)
select
  section.id, section.body_html_th, section.body_html_en, section.table_data,
  section.owner_name_th, section.owner_name_en, section.updated_at, section.updated_by
from public.manual_sections section
on conflict (section_id) do nothing;

revoke all on table public.manual_section_drafts from anon, authenticated;
grant select, insert, update, delete on table public.manual_section_drafts to service_role;

-- Direct updates to the published table must never create a version. The API uses
-- the publish function below, which sets this transaction-local flag deliberately.
create or replace function public.bump_manual_section_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(current_setting('app.manual_publish', true), '') = 'true' then
    return new;
  end if;

  new.revision_no := old.revision_no;
  return new;
end;
$$;

create or replace function public.capture_manual_section_revision()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor_name text;
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('app.manual_publish', true), '') <> 'true' then
    return new;
  end if;

  if tg_op = 'UPDATE' and new.revision_no = old.revision_no then
    return new;
  end if;

  select p.name into actor_name from public.profiles p where p.id = new.updated_by;

  insert into public.manual_section_revisions (
    section_id, revision_no, change_summary,
    owner_name_th, owner_name_en, body_html_th, body_html_en, table_data,
    changed_at, changed_by, changed_by_name
  ) values (
    new.id, new.revision_no,
    coalesce(nullif(btrim(new.last_change_summary), ''), 'ปรับปรุงเนื้อหาคู่มือออนไลน์'),
    new.owner_name_th, new.owner_name_en, new.body_html_th, new.body_html_en, new.table_data,
    coalesce(new.updated_at, now()), new.updated_by, actor_name
  )
  on conflict (section_id, revision_no) do nothing;

  update public.manual_publication publication
  set
    reviewed_at = (select max(section.updated_at)::date from public.manual_sections section)
  where publication.id = 'main';

  return new;
end;
$$;

create or replace function public.publish_manual_section_draft(
  p_section_id text,
  p_actor_id uuid,
  p_change_summary text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  draft_row public.manual_section_drafts%rowtype;
  published_row public.manual_sections%rowtype;
begin
  if nullif(btrim(p_change_summary), '') is null then
    raise exception 'กรุณาระบุสรุปการเปลี่ยนแปลงก่อนเผยแพร่';
  end if;

  select * into draft_row
  from public.manual_section_drafts
  where section_id = p_section_id
  for update;
  if not found then
    raise exception 'ไม่พบร่างการแก้ไขของหัวข้อนี้';
  end if;

  select * into published_row
  from public.manual_sections
  where id = p_section_id
  for update;
  if not found then
    raise exception 'ไม่พบหัวข้อคู่มือ';
  end if;

  if row(
    draft_row.body_html_th, draft_row.body_html_en, draft_row.table_data,
    draft_row.owner_name_th, draft_row.owner_name_en
  ) is not distinct from row(
    published_row.body_html_th, published_row.body_html_en, published_row.table_data,
    published_row.owner_name_th, published_row.owner_name_en
  ) then
    raise exception 'ไม่มีการเปลี่ยนแปลงในร่างที่ต้องเผยแพร่';
  end if;

  perform set_config('app.manual_publish', 'true', true);

  update public.manual_sections
  set
    body_html_th = draft_row.body_html_th,
    body_html_en = draft_row.body_html_en,
    table_data = draft_row.table_data,
    owner_name_th = draft_row.owner_name_th,
    owner_name_en = draft_row.owner_name_en,
    revision_no = published_row.revision_no + 1,
    last_change_summary = btrim(p_change_summary),
    updated_at = now(),
    updated_by = p_actor_id
  where id = p_section_id;
end;
$$;

revoke all on function public.publish_manual_section_draft(text, uuid, text) from public, anon, authenticated;
grant execute on function public.publish_manual_section_draft(text, uuid, text) to service_role;

-- Consolidate the micro section's rapid working saves (versions 2–9) into one
-- published Version 2. Version 1 remains the original online-manual import.
delete from public.manual_section_revisions
where section_id = 'micro' and revision_no >= 2;

select set_config('app.manual_publish', 'true', true);

update public.manual_sections
set
  revision_no = 2,
  last_change_summary = 'ปรับปรุงแนวทางการติดป้ายและการเก็บรักษาสิ่งตัวอย่างส่งตรวจและเชื้อจุลชีพให้เข้าใจง่าย',
  updated_at = now()
where id = 'micro';
