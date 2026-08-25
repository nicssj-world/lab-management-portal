-- Derived analysis for rejection rows whose reject reason is "อื่นๆ".
-- Raw rejection_logs.reason is intentionally preserved unchanged.

alter table public.rejection_logs
  add column if not exists reason_normalized text,
  add column if not exists reason_category text,
  add column if not exists reason_confidence numeric(4,3),
  add column if not exists reason_analysis_source text,
  add column if not exists reason_analysis_rule text,
  add column if not exists reason_analyzed_at timestamptz,
  add column if not exists reason_reviewed_by uuid references public.profiles(id),
  add column if not exists reason_reviewed_at timestamptz;

create index if not exists rejection_logs_reason_category_idx
  on public.rejection_logs (reason_category);

create index if not exists rejection_logs_reason_normalized_idx
  on public.rejection_logs (reason_normalized);

create table if not exists public.rejection_reason_mappings (
  normalized_reason text primary key,
  category_code text not null,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

alter table public.rejection_reason_mappings enable row level security;

-- The table is accessed only by the authenticated server route through the
-- service role. Do not expose free-text mappings through the Data API.
revoke all on table public.rejection_reason_mappings from anon, authenticated;

