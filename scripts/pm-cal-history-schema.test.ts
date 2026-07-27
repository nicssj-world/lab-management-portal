import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = [
  readFileSync('scripts/pm-cal-history.sql', 'utf8'),
  readFileSync('supabase/migrations/20260728130000_pm_cal_plan_groups.sql', 'utf8'),
].join('\n')

assert.match(sql, /create table if not exists public\.equipment_pm_cal_plans/i)
assert.match(sql, /alter table public\.equipment_calibrations/i)
assert.match(sql, /fiscal_year integer not null/i)
assert.match(sql, /calendar_month smallint not null/i)
assert.match(sql, /check \(calendar_month between 1 and 12\)/i)
assert.match(sql, /cal_type in \('PM', 'CAL'\)/i)
assert.match(sql, /result in \('PASS', 'FAIL', 'NOT_PERFORMED'\)/i)
assert.match(sql, /equipment_calibrations_pm_result_check/i)
assert.match(sql, /enable row level security/gi)
assert.match(sql, /grant select, insert, update, delete on public\.equipment_pm_cal_plans to service_role/i)
assert.match(sql, /equipment_pm_cal_active_plan_unique/i)
assert.match(sql, /drop constraint if exists equipment_calibrations_equipment_id_year_month_cal_type_key/i)
assert.match(sql, /foreign key \(plan_id, equipment_id, cal_type\)[\s\S]*references public\.equipment_pm_cal_plans \(id, equipment_id, cal_type\)/i)
assert.match(sql, /equipment_calibrations_plan_identity_idx[\s\S]*\(plan_id, equipment_id, cal_type\)/i)
assert.match(sql, /p_expected_versions jsonb/i)
assert.match(sql, /PM\/CAL plan set was changed by another user/i)
assert.match(sql, /from public\.equipment\s+where id = p_equipment_id\s+for update/i)
for (const index of ['equipment_pm_cal_plans_created_by_idx', 'equipment_pm_cal_plans_updated_by_idx', 'equipment_calibrations_created_by_idx', 'equipment_calibrations_updated_by_idx']) {
  assert.match(sql, new RegExp(index, 'i'))
}
assert.match(sql, /legacy_import/i)
assert.match(sql, /pg_input_is_valid/i)
assert.match(sql, /alter column fiscal_year drop not null/i)
assert.match(sql, /alter column calendar_month drop not null/i)
assert.match(sql, /certificate-only/i)
assert.doesNotMatch(sql, /grant .* to anon/i)
assert.doesNotMatch(sql, /grant .* to authenticated/i)

assert.match(sql, /create table if not exists public\.equipment_pm_cal_plan_groups/i)
assert.match(sql, /price_mode text not null[\s\S]*price_mode in \('per_unit', 'lump_sum'\)/i)
assert.match(sql, /plan_group_id uuid references public\.equipment_pm_cal_plan_groups\(id\)/i)
assert.match(sql, /create or replace function public\.replace_equipment_pm_cal_plan_group/i)
assert.match(sql, /create or replace function public\.cancel_equipment_pm_cal_plan_group/i)
assert.match(sql, /group has member results/i)
assert.match(sql, /planned_cost[\s\S]*price_mode = 'per_unit'/i)

console.log('pm-cal history schema contract passed')
