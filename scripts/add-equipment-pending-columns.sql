-- Add "รอขึ้นทะเบียน" flags for CBH code and hospital asset number
alter table equipment
  add column if not exists cbh_code_pending boolean not null default false,
  add column if not exists hospital_asset_no_pending boolean not null default false;
