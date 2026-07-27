create index if not exists equipment_pm_cal_plans_created_by_idx on public.equipment_pm_cal_plans (created_by);
create index if not exists equipment_pm_cal_plans_updated_by_idx on public.equipment_pm_cal_plans (updated_by);
create index if not exists equipment_calibrations_created_by_idx on public.equipment_calibrations (created_by);
create index if not exists equipment_calibrations_updated_by_idx on public.equipment_calibrations (updated_by);
