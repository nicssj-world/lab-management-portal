-- Quality document workflow v2
-- Run via Supabase Dashboard -> SQL Editor

-- User document identity ----------------------------------------------------
alter table profiles
  add column if not exists document_position text,
  add column if not exists signature_url text,
  add column if not exists signature_updated_at timestamptz,
  add column if not exists signature_updated_by uuid references profiles(id) on delete set null;

insert into storage.buckets (id, name, public)
values ('signatures', 'signatures', false)
on conflict (id) do update set public = false;

drop policy if exists "Service role full access signatures" on storage.objects;
create policy "Service role full access signatures"
  on storage.objects for all to service_role
  using (bucket_id = 'signatures')
  with check (bucket_id = 'signatures');

-- Documents -----------------------------------------------------------------
alter table documents
  alter column file_url drop not null,
  alter column file_name drop not null,
  add column if not exists source_pdf_url text,
  add column if not exists source_pdf_name text,
  add column if not exists source_pdf_size bigint,
  add column if not exists source_pdf_mime_type text,
  add column if not exists edit_date date,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists approved_by_id uuid references profiles(id) on delete set null,
  add column if not exists published_by_id uuid references profiles(id) on delete set null,
  add column if not exists reviewer_id uuid references profiles(id) on delete set null,
  add column if not exists approver_id uuid references profiles(id) on delete set null,
  add column if not exists audience_text text,
  add column if not exists cover_template_version text,
  add column if not exists cover_generated_at timestamptz,
  add column if not exists cover_metadata jsonb,
  add column if not exists imported_current_at timestamptz,
  add column if not exists imported_current_by uuid references profiles(id) on delete set null,
  add column if not exists imported_current_note text,
  add column if not exists legacy_cover_included boolean not null default false;

-- Revision history archive expansion ---------------------------------------
alter table document_revisions
  alter column file_url drop not null,
  alter column file_name drop not null,
  add column if not exists revised_by text,
  add column if not exists approved_by text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists source_pdf_url text,
  add column if not exists source_pdf_name text,
  add column if not exists source_pdf_size bigint,
  add column if not exists source_pdf_mime_type text,
  add column if not exists word_url text,
  add column if not exists word_name text,
  add column if not exists word_size bigint,
  add column if not exists edit_date date,
  add column if not exists effective_date date,
  add column if not exists expiry_date date,
  add column if not exists approved_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists approved_by_id uuid references profiles(id) on delete set null,
  add column if not exists published_by_id uuid references profiles(id) on delete set null,
  add column if not exists reviewer_id uuid references profiles(id) on delete set null,
  add column if not exists approver_id uuid references profiles(id) on delete set null,
  add column if not exists audience_text text,
  add column if not exists cover_template_version text,
  add column if not exists cover_generated_at timestamptz,
  add column if not exists cover_metadata jsonb,
  add column if not exists imported_current_at timestamptz,
  add column if not exists imported_current_by uuid references profiles(id) on delete set null,
  add column if not exists imported_current_note text,
  add column if not exists legacy_cover_included boolean not null default false,
  add column if not exists history_source text not null default 'workflow'
    check (history_source in ('workflow','backfill','legacy'));

update document_revisions
set expiry_date = coalesce(expiry_date, edit_date, effective_date)
where expiry_date is null;

-- Working revisions ---------------------------------------------------------
create table if not exists document_revision_drafts (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  revision text not null,
  title text not null,
  type text not null,
  department text,
  description text,
  status text not null default 'Draft'
    check (status in ('Draft','Review','Approved','Published','Obsolete')),
  visibility text not null default 'Internal'
    check (visibility in ('Public','Internal')),
  owner_name text,
  reviewer_name text,
  approver_name text,
  reviewer_id uuid references profiles(id) on delete set null,
  approver_id uuid references profiles(id) on delete set null,
  audience_text text,
  file_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  source_pdf_url text,
  source_pdf_name text,
  source_pdf_size bigint,
  source_pdf_mime_type text,
  word_url text,
  word_name text,
  word_size bigint,
  edit_date date,
  effective_date date,
  expiry_date date,
  approved_at timestamptz,
  published_at timestamptz,
  approved_by_id uuid references profiles(id) on delete set null,
  published_by_id uuid references profiles(id) on delete set null,
  cover_template_version text,
  cover_generated_at timestamptz,
  cover_metadata jsonb,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancelled_by uuid references profiles(id) on delete set null,
  cancel_reason text
);

drop index if exists document_revision_drafts_one_active;
create unique index if not exists document_revision_drafts_one_active
  on document_revision_drafts(document_id)
  where cancelled_at is null and status <> 'Published';

create index if not exists idx_document_revision_drafts_document_id
  on document_revision_drafts(document_id);

create index if not exists idx_document_revision_drafts_status
  on document_revision_drafts(status)
  where cancelled_at is null;

alter table document_revision_drafts enable row level security;

drop policy if exists "Service role full access document_revision_drafts" on document_revision_drafts;
create policy "Service role full access document_revision_drafts"
  on document_revision_drafts for all to service_role using (true) with check (true);

-- Status transition history ------------------------------------------------
create table if not exists document_status_history (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  from_status text check (from_status is null or from_status in ('Draft','Review','Approved','Published','Obsolete')),
  to_status text not null check (to_status in ('Draft','Review','Approved','Published','Obsolete')),
  changed_by uuid references profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create index if not exists idx_document_status_history_document_id_changed_at
  on document_status_history(document_id, changed_at);

alter table document_status_history enable row level security;

drop policy if exists "authenticated read document status history" on document_status_history;
create policy "authenticated read document status history"
  on document_status_history for select to authenticated using (true);

insert into document_status_history (document_id, from_status, to_status, changed_at)
select d.id, null, d.status, coalesce(d.created_at, now())
from documents d
where not exists (
  select 1
  from document_status_history h
  where h.document_id = d.id
);
