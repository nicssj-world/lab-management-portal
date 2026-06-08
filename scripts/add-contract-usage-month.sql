-- Separate the date a usage record was entered from the month shown in charts.
alter table contract_usage add column if not exists usage_month date;

update contract_usage
set usage_month = date_trunc('month', usage_date)::date
where usage_month is null
  and usage_date is not null;

create index if not exists contract_usage_contract_month_idx
  on contract_usage (contract_id, usage_month desc);
