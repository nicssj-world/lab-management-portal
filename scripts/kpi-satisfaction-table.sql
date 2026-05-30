-- Satisfaction survey table: annual (not monthly), 3 metrics
create table if not exists kpi_satisfaction (
  id           bigserial primary key,
  metric_code  text not null,
  metric_name  text not null,
  fiscal_year  int  not null,
  value        numeric(8,2),
  target_val   numeric(8,2) not null default 80,
  created_at   timestamptz default now(),
  unique (metric_code, fiscal_year)
);

-- RLS
alter table kpi_satisfaction enable row level security;
create policy "kpi_satisfaction_auth_read"  on kpi_satisfaction for select using (auth.role() = 'authenticated');
create policy "kpi_satisfaction_staff_write" on kpi_satisfaction for all using (auth.role() = 'authenticated');

-- Seed from spreadsheet data
insert into kpi_satisfaction (metric_code, metric_name, fiscal_year, value) values
  ('outpatient', 'ผู้ป่วยนอก',          2564, 88.22),
  ('outpatient', 'ผู้ป่วยนอก',          2565, 85.59),
  ('outpatient', 'ผู้ป่วยนอก',          2566, 89.10),
  ('outpatient', 'ผู้ป่วยนอก',          2567, 89.79),
  ('inpatient',  'ผู้ป่วยใน',           2568, 75.37),
  ('donor',      'ผู้รับบริจาคโลหิต',   2564, 89.57),
  ('donor',      'ผู้รับบริจาคโลหิต',   2565, 89.45),
  ('donor',      'ผู้รับบริจาคโลหิต',   2566, 90.73),
  ('donor',      'ผู้รับบริจาคโลหิต',   2567, 90.78),
  ('donor',      'ผู้รับบริจาคโลหิต',   2568, 91.32)
on conflict (metric_code, fiscal_year) do nothing;
