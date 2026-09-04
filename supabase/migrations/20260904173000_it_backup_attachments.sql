-- Evidence files for IT backup / restore-test logs.
-- File bytes live in the shared R2 bucket; this table stores the guarded
-- metadata and the object key needed to stream or remove them.

create table if not exists public.it_backup_attachments (
  id             uuid primary key default gen_random_uuid(),
  backup_log_id  uuid not null references public.it_backup_logs(id) on delete cascade,
  r2_key         text not null unique,
  file_name      text not null,
  content_type   text not null check (content_type in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes     bigint not null check (size_bytes between 1 and 20971520),
  uploaded_by    uuid not null references public.profiles(id),
  uploaded_at   timestamptz not null default now()
);

create index if not exists it_backup_attachments_log_idx
  on public.it_backup_attachments(backup_log_id, uploaded_at);

alter table public.it_backup_attachments enable row level security;

drop policy if exists it_backup_attachments_authenticated_read on public.it_backup_attachments;
create policy it_backup_attachments_authenticated_read
  on public.it_backup_attachments for select to authenticated using (true);

-- All writes and file access go through guarded server routes using service_role.
revoke insert, update, delete, truncate, references, trigger
  on table public.it_backup_attachments from anon, authenticated;
