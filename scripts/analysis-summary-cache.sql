-- Persistent cache for expensive dashboard analysis payloads.
-- Run once in Supabase SQL Editor.

create table if not exists analysis_summary_cache (
  endpoint text not null,
  cache_key text not null,
  year int not null,
  month int not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (endpoint, cache_key)
);

create index if not exists idx_analysis_summary_cache_endpoint_month
  on analysis_summary_cache (endpoint, year, month);

create index if not exists idx_analysis_summary_cache_expires_at
  on analysis_summary_cache (expires_at);
