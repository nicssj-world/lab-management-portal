create index if not exists equipment_calibrations_plan_identity_idx
  on public.equipment_calibrations (plan_id, equipment_id, cal_type);
