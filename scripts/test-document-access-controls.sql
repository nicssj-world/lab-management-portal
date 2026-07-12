alter table public.tests
  add column if not exists related_doc_access jsonb not null default '{}'::jsonb;

alter table public.test_documents
  add column if not exists visibility text not null default 'Internal',
  add column if not exists access_mode text not null default 'view';

alter table public.test_documents
  drop constraint if exists test_documents_visibility_check,
  add constraint test_documents_visibility_check check (visibility in ('Internal', 'Public')),
  drop constraint if exists test_documents_access_mode_check,
  add constraint test_documents_access_mode_check check (access_mode in ('view', 'download', 'both'));
