import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync('supabase/migrations/20260823090000_lab_map_evacuation_module.sql', 'utf8')
for (const table of ['evacuation_plan_versions', 'evacuation_exit_assignments', 'evacuation_drill_cycles', 'evacuation_drill_sessions', 'evacuation_drill_evidence']) {
  assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${table}`), `${table} ต้องมี migration`)
}
assert.match(sql, /evacuation_plan_review/)
assert.match(sql, /evacuation_drill/)
assert.match(sql, /quality_task_attachments\(id\)/)
assert.match(sql, /ALTER TABLE public\.evacuation_plan_versions ENABLE ROW LEVEL SECURITY/)
assert.match(sql, /REVOKE ALL ON public\.evacuation_plan_versions[\s\S]*FROM anon, authenticated/)
assert.match(sql, /publish_evacuation_plan\(target_plan_id uuid\)/)
assert.match(sql, /pg_advisory_xact_lock/)
assert.match(sql, /UNIQUE \(fiscal_year, plan_version_id\)/)
console.log('evacuation schema contract passed')
