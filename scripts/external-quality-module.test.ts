import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(process.cwd(), 'scripts/external-quality-module.sql'), 'utf8').toLowerCase()

for (const table of [
  'outlab_editors', 'outlab_laboratories', 'outlab_laboratory_owners', 'outlab_services',
  'outlab_certificates', 'outlab_certificate_files', 'eqa_editors', 'eqa_providers',
  'eqa_programs', 'eqa_program_owners', 'eqa_coverage_requirements', 'eqa_program_tests',
  'eqa_rounds', 'eqa_round_results', 'eqa_capas', 'eqa_capa_results', 'eqa_attachments',
]) assert.ok(sql.includes(`create table if not exists public.${table}`), `creates ${table}`)

assert.ok(sql.includes('outlab_one_primary_catalog_service'), 'enforces one active primary OUTLAB destination per catalog test')
assert.ok(sql.includes("manual_test_name is not null"), 'enforces catalog/manual OUTLAB service identity')
assert.ok(sql.includes("mode <> 'required_eqa'"), 'requires a reason for alternative/not-applicable coverage')
assert.ok(sql.includes('enable row level security'), 'enables RLS')
assert.ok(sql.includes("to authenticated using (true)"), 'authenticated staff can read module data')

console.log('scripts/external-quality-module.test.ts: all assertions passed')
