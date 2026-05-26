-- TAT dashboard performance indexes
-- Run in Supabase SQL Editor after deploying/updating get_tat_summary.

create index if not exists idx_tat_records_summary_filters
  on tat_records (year, month, lab_section, ward, priority, test_name, labzone_name);

create index if not exists idx_tat_records_summary_blood_samples
  on tat_records (year, month, is_blood_draw, ln, match_confidence)
  include (register_at, queue_confirmed_at, phleb_done_at, spcm_at, rslt_at, tat_minutes, phleb_wait_minutes, phleb_draw_minutes);

create index if not exists idx_tat_records_summary_heatmap
  on tat_records (year, month, spcm_dow, spcm_hour)
  where spcm_dow is not null and spcm_hour is not null;

create index if not exists idx_phleb_records_summary_hn
  on phlebotomy_records (year, month, labzone_name, hn);

analyze tat_records;
analyze phlebotomy_records;
