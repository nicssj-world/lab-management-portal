-- Store the TAT source column name_1 so workload can split ศสม. records.
alter table tat_records add column if not exists name_1 text;

create index if not exists idx_tat_records_year_month_name1
  on tat_records (year, month, name_1);
