-- Separate document-control dates from the automatic section-review date.
-- revision_date and effective_date are set by the document controller;
-- reviewed_at remains the only date updated by section publication.

alter table public.manual_publication
  add column if not exists revision_date date;

update public.manual_publication publication
set revision_date = history.revision_date
from public.manual_publication_revisions history
where publication.id = 'main'
  and history.revision = publication.revision
  and publication.revision_date is null;

create or replace function public.sync_manual_publication_revision_history()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.manual_publication_revisions history
  set
    revision_date = new.revision_date,
    effective_date = new.effective_date,
    revised_by_name = new.revised_by_name,
    approved_by_name = new.approved_by_name
  where history.revision = new.revision;

  return new;
end;
$$;

drop trigger if exists trg_manual_publication_revision_sync on public.manual_publication;
create trigger trg_manual_publication_revision_sync
after insert or update of revision, revision_date, effective_date, revised_by_name, approved_by_name
on public.manual_publication
for each row execute function public.sync_manual_publication_revision_history();
