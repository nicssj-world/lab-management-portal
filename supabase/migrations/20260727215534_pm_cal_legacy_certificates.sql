alter table public.equipment_calibrations
  alter column fiscal_year drop not null,
  alter column calendar_month drop not null;

insert into public.equipment_calibrations (
  equipment_id, fiscal_year, calendar_month, cal_type, planned, completed_date,
  result, certificate_no, error_value, uncertainty, notes, certificate_file_url,
  source, legacy_key
)
select e.id, null, null, 'CAL', false, null,
       case
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) = 'pass' then 'PASS'
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) like '%fail%' then 'FAIL'
         when lower(coalesce(e.pm_cal_data->>'cal_result','')) in ('no cal','not performed','ไม่ได้สอบเทียบ') then 'NOT_PERFORMED'
         else null
       end,
       nullif(e.pm_cal_data->>'certificate_no',''),
       nullif(e.pm_cal_data->>'error_value',''),
       nullif(e.pm_cal_data->>'uncertainty',''),
       nullif(e.pm_cal_data->>'remark',''),
       nullif(e.pm_cal_data->>'certificate_file_url',''),
       'legacy_import', e.id::text || ':CAL:certificate-only'
from public.equipment e
where nullif(e.pm_cal_data->>'certificate_file_url','') is not null
  and not exists (
    select 1 from public.equipment_calibrations history
    where history.equipment_id = e.id
      and history.certificate_file_url = e.pm_cal_data->>'certificate_file_url'
  )
on conflict (legacy_key) where legacy_key is not null do nothing;
