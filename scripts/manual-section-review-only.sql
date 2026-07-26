-- A published section change updates only the manual's latest-review date.
-- It must not overwrite the document-level revision/change record.

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
  set reviewed_at = (select max(section.updated_at)::date from public.manual_sections section)
  where publication.id = 'main';

  return new;
end;
$$;

-- Restore the document-level revision description that was previously replaced
-- by a section-level publication summary.
update public.manual_publication_revisions
set change_summary = 'นำเข้าเนื้อหาปัจจุบันเข้าสู่คู่มือออนไลน์'
where revision = (select revision from public.manual_publication where id = 'main')
  and source_document = 'คู่มือออนไลน์ MN-LAB-01';
