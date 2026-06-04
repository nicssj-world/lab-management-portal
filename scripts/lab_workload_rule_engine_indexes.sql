-- Lab Workload rule-engine read indexes
-- Run via Supabase Dashboard -> SQL Editor if the workload page times out while
-- rebuilding rule-correct summaries from raw TAT/Phlebotomy records.

create index if not exists idx_tat_records_year_month_id
  on tat_records (year, month, id);

create index if not exists idx_phleb_records_year_month_id
  on phlebotomy_records (year, month, id);
