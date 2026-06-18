alter table document_revisions
  add column if not exists expiry_date date;

update document_revisions
set expiry_date = coalesce(expiry_date, edit_date, effective_date)
where expiry_date is null;
