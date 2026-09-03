import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { readFileSync, readdirSync } from 'node:fs'
import { DRIVE_LEGACY_SOURCES, parseDriveWorkbook } from '../lib/it-verification/drive-sources'
import { buildLegacyRpcPayload, parseRequestedYears } from './it-verification-drive-import'

const root = process.cwd()

function workbookBuffer() {
  const workbook = XLSX.utils.book_new()
  const rows = [
    ['', 'งาน ภูมิคุ้มกันวิทยาคลินิก', '', 'มกราคม-มีนาคม 2568'],
    [],
    ['', '', '', 'LAB ID', ' LN-IMM-001 '],
    [],
    ['', '', '', 'ผลการตรวจสอบ', 'P'],
    ['', '', '', 'ผลการตรวจสอบ', 'P'],
  ]
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), 'Q1')
  for (const quarter of [2, 3, 4]) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), `Q${quarter}`)
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

test('Drive source manifest covers all selected years, departments and quarter tabs', () => {
  assert.deepEqual(Object.keys(DRIVE_LEGACY_SOURCES).map(Number), [2567, 2568, 2569])
  for (const sources of Object.values(DRIVE_LEGACY_SOURCES)) {
    assert.deepEqual(sources.map((source) => source.departmentCode).sort(), ['BLB', 'CHE', 'HEM', 'MIC', 'MIS', 'MOL', 'IMM'].sort())
    assert.ok(sources.every((source) => source.spreadsheetId.length > 20))
  }
})

test('Drive workbook parser uses the folder year and preserves all four quarters', () => {
  const result = parseDriveWorkbook(workbookBuffer(), {
    folderYear: 2026,
    departmentCode: 'IMM',
    sourceFileId: 'drive-imm',
    sourceFileName: '[IMM] Fm-QP-LAB-24-02',
  })

  assert.deepEqual(result.map((quarter) => quarter.quarter), [1, 2, 3, 4])
  assert.equal(result[0].year, 2026)
  assert.equal(result[0].samples[0].ln, 'LN-IMM-001')
  assert.equal(result[0].samples[0].sourceToLis, 'pass')
  assert.equal(result[0].samples[0].lisToHis, 'pass')
  assert.match(result[0].warnings.join(' '), /2568/)
})

test('legacy form migration exposes a service-only transactional import RPC', () => {
  const files = readdirSync(`${root}/supabase/migrations`)
  const file = files.find((name) => name.includes('it_verification'))
  assert.ok(file)
  const sql = readFileSync(`${root}/supabase/migrations/${file}`, 'utf8').replace(/\r\n/g, '\n')
  assert.match(sql, /import_it_verification_legacy_form/i)
  assert.match(sql, /legacy-form-v1/i)
  assert.match(sql, /revoke all on function public\.import_it_verification_legacy_form[\s\S]*?from public, anon, authenticated/i)
  assert.match(sql, /grant execute on function public\.import_it_verification_legacy_form[\s\S]*?to service_role/i)
})

test('drive import defaults to all historical folders and accepts explicit Buddhist years', () => {
  assert.deepEqual(parseRequestedYears([]), [2567, 2568, 2569])
  assert.deepEqual(parseRequestedYears(['--years', '2569,2567']), [2567, 2569])
  assert.throws(() => parseRequestedYears(['--years', '2566']), /2567.*2568.*2569|Unsupported/i)
})

test('drive import RPC payload keeps the historical source month unset', () => {
  const source = parseDriveWorkbook(workbookBuffer(), {
    folderYear: 2026,
    departmentCode: 'IMM',
    sourceFileId: 'drive-imm',
    sourceFileName: '[IMM] Fm-QP-LAB-24-02',
  })[0]
  const payload = buildLegacyRpcPayload(source, 'drive-imm', 'actor-id', 12)
  assert.equal(payload.p_year, 2026)
  assert.equal(payload.p_quarter, 1)
  assert.equal(payload.p_department_id, 12)
  assert.equal(payload.p_actor_id, 'actor-id')
  assert.equal('source_month' in payload.p_samples[0], false)
  assert.equal(payload.p_samples[0].lis_to_his, 'pass')
  assert.equal(payload.p_samples[0].source_to_lis, 'pass')
  assert.equal('hn' in payload.p_samples[0], false)
})
