#!/usr/bin/env node
import dotenv from 'dotenv'
import { readFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config()

const DEPARTMENT_CODES = new Set(['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB'])
const RESULT_VALUES = new Set(['pass', 'fail', 'na', ''])

function parseArgs() {
  const output = {}
  for (let index = 2; index < process.argv.length; index++) {
    const token = process.argv[index]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = process.argv[index + 1]
    if (!next || next.startsWith('--')) output[key] = true
    else { output[key] = next; index++ }
  }
  return output
}

function usage() {
  console.log(`
Usage:
  node scripts/it-verification-legacy.mjs --file evidence.tsv --round-id <uuid> --department-id 11 [--actor-id <uuid>]

Required columns:
  ln

Optional metadata/results:
  lis_to_his, source_to_lis, remark, source_lab_section, test_name,
  first_spcm_at, last_result_at, source_record_count, source_month,
  finding_lis_to_his, finding_source_to_lis, finding_severity, finding

The importer accepts LN and operational metadata only. Patient names and HN are rejected.
`)
}

function parseDelimitedLine(line, delimiter) {
  const cells = []
  let value = ''
  let quoted = false
  for (let index = 0; index < line.length; index++) {
    const character = line[index]
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index++ }
      else quoted = !quoted
    } else if (character === delimiter && !quoted) { cells.push(value); value = '' }
    else value += character
  }
  cells.push(value)
  return cells
}

function parseFile(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) throw new Error('Legacy file must contain a header and at least one row')
  const delimiter = lines[0].includes('\t') ? '\t' : ','
  const headers = parseDelimitedLine(lines[0], delimiter).map(value => value.trim().toLowerCase())
  const forbidden = headers.filter(header => ['hn', 'patient_name', 'name', 'name_1'].includes(header))
  if (forbidden.length > 0) throw new Error(`Legacy file must not contain patient identifiers: ${forbidden.join(', ')}`)
  if (!headers.includes('ln')) throw new Error('Legacy file must contain an ln column')
  return lines.slice(1).map((line, rowIndex) => {
    const cells = parseDelimitedLine(line, delimiter)
    return { ...Object.fromEntries(headers.map((header, index) => [header, cells[index]?.trim() || null])), __row: rowIndex + 2 }
  })
}

function normalizeResult(value) {
  const result = value?.trim().toLowerCase() || null
  if (!RESULT_VALUES.has(result || '')) throw new Error(`Invalid result: ${value}`)
  return result
}

function normalizeFinding(value) {
  const finding = value?.trim() || null
  return finding ? finding.slice(0, 2000) : null
}

function parseCount(value, rowNumber) {
  if (!value) return 0
  const count = Number(value)
  if (!Number.isInteger(count) || count < 0) throw new Error(`Row ${rowNumber}: source_record_count must be a non-negative integer`)
  return count
}

function parseOptionalTimestamp(value, rowNumber, field) {
  if (!value?.trim()) return null
  if (Number.isNaN(Date.parse(value))) throw new Error(`Row ${rowNumber}: ${field} must be a valid timestamp`)
  return value.trim()
}

async function main() {
  const args = parseArgs()
  if (args.help) { usage(); return }
  if (!args.file || !args['round-id'] || !args['department-id']) { usage(); throw new Error('--file, --round-id and --department-id are required') }
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) throw new Error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

  const rows = parseFile(await readFile(args.file, 'utf8'))
  const departmentId = Number(args['department-id'])
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })
  const { data: round, error: roundError } = await supabase.from('it_verification_rounds').select('id, department_id, status').eq('id', args['round-id']).maybeSingle()
  if (roundError) throw new Error(`round lookup failed: ${roundError.message}`)
  if (!round) throw new Error('Round not found')
  if (round.department_id !== departmentId) throw new Error('Department does not match the selected round')
  if (round.status === 'reviewed') throw new Error('Round is locked; reopen it before importing legacy evidence')
  const { data: department, error: departmentError } = await supabase.from('departments').select('code').eq('id', departmentId).maybeSingle()
  if (departmentError) throw new Error(`department lookup failed: ${departmentError.message}`)
  if (!department || !DEPARTMENT_CODES.has(department.code)) throw new Error('Department is outside the IT verification scope')

  const { data: existingSamples, error: existingError } = await supabase
    .from('it_verification_samples')
    .select('ln')
    .eq('round_id', args['round-id'])
    .eq('department_id', departmentId)
    .eq('sample_state', 'active')
  if (existingError) throw new Error(`existing sample lookup failed: ${existingError.message}`)
  const existingLns = new Set((existingSamples || []).map(row => row.ln))

  const seen = new Set()
  const records = rows.map(row => {
    const ln = row.ln?.trim()
    if (!ln) throw new Error(`Row ${row.__row}: ln is required`)
    if (seen.has(ln) || existingLns.has(ln)) throw new Error(`Row ${row.__row}: duplicate active ln ${ln}`)
    seen.add(ln)
    const sourceMonth = row.source_month ? Number(row.source_month) : null
    if (sourceMonth !== null && (!Number.isInteger(sourceMonth) || sourceMonth < 1 || sourceMonth > 12)) throw new Error(`Row ${row.__row}: source_month must be 1..12 or empty`)
    const lisToHis = normalizeResult(row.lis_to_his)
    const sourceToLis = normalizeResult(row.source_to_lis)
    if ((lisToHis === 'na' || sourceToLis === 'na') && !row.remark?.trim()) throw new Error(`Row ${row.__row}: N/A requires a remark`)
    const sharedFinding = normalizeFinding(row.finding)
    const lisFinding = normalizeFinding(row.finding_lis_to_his || row.lis_to_his_finding || (lisToHis === 'fail' && !sourceToLis ? sharedFinding : null))
    const sourceFinding = normalizeFinding(row.finding_source_to_lis || row.source_to_lis_finding || (sourceToLis === 'fail' && !lisToHis ? sharedFinding : null))
    if (lisToHis === 'fail' && !lisFinding) throw new Error(`Row ${row.__row}: LIS to HIS fail requires finding_lis_to_his`)
    if (sourceToLis === 'fail' && !sourceFinding) throw new Error(`Row ${row.__row}: source to LIS fail requires finding_source_to_lis`)
    const severity = (row.finding_severity?.trim().toLowerCase() || 'medium')
    if (!['low', 'medium', 'high'].includes(severity)) throw new Error(`Row ${row.__row}: finding_severity must be low, medium or high`)
    return {
      round_id: args['round-id'], department_id: departmentId, ln,
      source_month: sourceMonth, source_lab_section: row.source_lab_section?.trim() || null,
      test_name: row.test_name?.trim() || null, first_spcm_at: parseOptionalTimestamp(row.first_spcm_at, row.__row, 'first_spcm_at'), last_result_at: parseOptionalTimestamp(row.last_result_at, row.__row, 'last_result_at'),
      source_record_count: parseCount(row.source_record_count, row.__row), sampling_method: 'legacy_manual',
      lis_to_his: lisToHis, source_to_lis: sourceToLis, remark: row.remark || '',
      findings: [
        ...(lisFinding ? [{ transfer_point: 'lis_to_his', description: lisFinding, severity }] : []),
        ...(sourceFinding ? [{ transfer_point: 'source_to_lis', description: sourceFinding, severity }] : []),
      ],
    }
  })

  if ((existingSamples?.length || 0) + records.length > 10) throw new Error('A round cannot contain more than 10 active samples per department')

  const actorId = args['actor-id'] || null
  if (actorId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actorId)) throw new Error('--actor-id must be a UUID')
  const { data: run, error: runError } = await supabase.from('it_verification_sampling_runs').insert({
    round_id: args['round-id'], source_year: null, source_month: null, trigger: 'legacy_import', sampling_method: 'legacy_manual',
    algorithm: 'legacy-manual', quota: records.length, population_count: records.length, sampled_count: records.length, status: 'completed', created_by: actorId,
  }).select('id').single()
  if (runError) throw new Error(`sampling run insert failed: ${runError.message}`)
  const sampleRows = records.map(({ findings: _findings, ...record }) => ({ ...record, sampling_run_id: run.id }))
  const { data: insertedSamples, error: sampleError } = await supabase.from('it_verification_samples').insert(sampleRows).select('id, ln')
  if (sampleError) {
    await supabase.from('it_verification_sampling_runs').update({ status: 'void', error_detail: `sample insert failed: ${sampleError.message}` }).eq('id', run.id)
    throw new Error(`sample insert failed: ${sampleError.message}`)
  }
  const sampleIdByLn = new Map((insertedSamples || []).map(sample => [sample.ln, sample.id]))
  const findingRows = records.flatMap(record => record.findings.map(finding => ({
    sample_id: sampleIdByLn.get(record.ln),
    round_id: args['round-id'],
    transfer_point: finding.transfer_point,
    description: finding.description,
    severity: finding.severity,
    opened_by: actorId,
  })))
  if (findingRows.length > 0) {
    const { error: findingError } = await supabase.from('it_verification_findings').insert(findingRows)
    if (findingError) {
      await supabase.from('it_verification_samples').update({ sample_state: 'void', voided_at: new Date().toISOString(), voided_by: actorId, void_reason: `legacy import finding failed: ${findingError.message}` }).eq('sampling_run_id', run.id)
      await supabase.from('it_verification_sampling_runs').update({ status: 'void', error_detail: `finding insert failed: ${findingError.message}` }).eq('id', run.id)
      throw new Error(`finding insert failed: ${findingError.message}`)
    }
  }
  const { error: auditError } = await supabase.from('audit_log').insert({
    action: 'it_verification.sampling.generate',
    user_id: actorId,
    target: args['round-id'],
    detail: `trigger=legacy_import; samples=${records.length}`,
  })
  if (auditError) console.warn(`Could not write legacy import audit: ${auditError.message}`)
  console.log(`Imported ${records.length} legacy samples into ${args['round-id']}`)
}

main().catch(error => { console.error(error.message || error); process.exit(1) })
