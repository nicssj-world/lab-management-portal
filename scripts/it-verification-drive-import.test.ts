import assert from 'node:assert/strict'
import test from 'node:test'
import * as XLSX from 'xlsx'
import { readFileSync, readdirSync } from 'node:fs'
import { DRIVE_LEGACY_RESPONSIBLE_SOURCES, DRIVE_LEGACY_SOURCES, parseDriveResponsibleWorkbook, parseDriveWorkbook } from '../lib/it-verification/drive-sources'
import { buildLegacyRpcPayload, loadDriveLegacySources, parseRequestedYears } from './it-verification-drive-import'

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

function responsibleWorkbookBuffer() {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['งาน', 'ชื่อ-นามสกุล', 'ตำแหน่ง'],
    ['เคมีคลินิก', 'สุธีมนต์', 'นักเทคนิคการแพทย์'],
    ['ภูมิคุ้มกัน', 'วรรษชล', 'นักเทคนิคการแพทย์'],
    ['โลหิต', 'สิริมา', 'นักเทคนิคการแพทย์'],
    ['จุลทรรศน์', 'วรวุฒิ', 'นักเทคนิคการแพทย์'],
    ['จุลชีววิทยา', 'นาคพรรดิ', 'นักเทคนิคการแพทย์'],
    ['อณูชีววิทยา', 'ศิริวัฒน์', 'นักเทคนิคการแพทย์'],
    ['คลังเลือด', 'ธนาวุฒิ', 'นักเทคนิคการแพทย์'],
  ]), 'Sheet1')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
}

test('Drive source manifest covers all selected years, departments and quarter tabs', () => {
  assert.deepEqual(Object.keys(DRIVE_LEGACY_SOURCES).map(Number), [2567, 2568, 2569])
  for (const sources of Object.values(DRIVE_LEGACY_SOURCES)) {
    assert.deepEqual(sources.map((source) => source.departmentCode).sort(), ['BLB', 'CHE', 'HEM', 'MIC', 'MIS', 'MOL', 'IMM'].sort())
    assert.ok(sources.every((source) => source.spreadsheetId.length > 20))
  }
})

test('Drive responsible source manifest and parser preserve the sheet department labels', () => {
  assert.deepEqual(Object.keys(DRIVE_LEGACY_RESPONSIBLE_SOURCES).map(Number), [2567, 2568, 2569])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['งาน', 'ชื่อ-นามสกุล', 'ตำแหน่ง'],
    ['จุลทรรศน์', 'วรวุฒิ', 'นักเทคนิคการแพทย์'],
  ]), 'Sheet1')
  const result = parseDriveResponsibleWorkbook(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }))
  assert.equal(result.responsibles[0]?.departmentCode, 'MIS')
  assert.equal(result.responsibles[0]?.displayName, 'วรวุฒิ')
})

test('Drive source loader carries the responsible name into every department source', async () => {
  const responsibleId = DRIVE_LEGACY_RESPONSIBLE_SOURCES[2569].spreadsheetId
  const responsibleBuffer = responsibleWorkbookBuffer()
  const formBuffer = workbookBuffer()
  const fetcher: typeof fetch = async (input) => {
    const url = String(input)
    const body = url.includes(`/d/${responsibleId}/`) ? responsibleBuffer : formBuffer
    return new Response(body, { status: 200, headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } })
  }
  const sources = await loadDriveLegacySources([2569], fetcher)

  assert.equal(sources.length, 7)
  assert.equal(sources.find((source) => source.sourceFileName.startsWith('[MIS]'))?.responsibleName, 'วรวุฒิ')
  assert.equal(sources.find((source) => source.sourceFileName.startsWith('[CHE]'))?.responsibleName, 'สุธีมนต์')
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
  assert.equal(result[0].warnings.some((warning) => warning.includes('2568')), false)
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
