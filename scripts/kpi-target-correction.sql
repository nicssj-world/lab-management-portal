-- KPI view compatibility migration.
-- KPI definitions are owned by /kpi/settings. This file must never overwrite
-- target_type, target_val, unit, or any other editable KPI setting.
alter table kpi_definitions add column if not exists denominator text default null;

create or replace view vw_kpi_dashboard as
select d.code as dept_code, d.name_th as dept_name,
       k.code as kpi_code, k.category, k.sub_code, k.name_th as kpi_name,
       k.target_type, k.target_val, k.unit,
       e.fiscal_year, e.month, e.numerator, e.denominator,
       case
         when k.denominator is null or e.numerator is null or e.denominator is null or e.denominator < 0 then null::numeric
         when e.denominator = 0 and e.numerator = 0 then null::numeric
         when e.denominator = 0 then null::numeric
         else round((e.numerator::numeric / e.denominator) * 100, 2)
       end::numeric(8,2) as result_pct,
       case
         when e.numerator is null then null::boolean
         when k.denominator is null then
           case
             when k.target_type = 'eq' then e.numerator = k.target_val
             when k.target_type = 'gte' then e.numerator >= k.target_val
             when k.target_type = 'lte' then e.numerator <= k.target_val
             else false
           end
         when e.denominator is null or e.denominator < 0 or (e.denominator = 0 and e.numerator <> 0) then null::boolean
         when e.denominator = 0 and e.numerator = 0 then null::boolean
         when k.target_type = 'eq' then round((e.numerator::numeric / e.denominator) * 100, 2) = k.target_val
         when k.target_type = 'gte' then round((e.numerator::numeric / e.denominator) * 100, 2) >= k.target_val
         when k.target_type = 'lte' then round((e.numerator::numeric / e.denominator) * 100, 2) <= k.target_val
         else false
       end as is_pass,
       k.denominator as denominator_label
from kpi_entries e
join departments d on d.id = e.dept_id
join kpi_definitions k on k.id = e.kpi_id;
