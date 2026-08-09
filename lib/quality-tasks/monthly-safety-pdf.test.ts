import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { createMonthlySafetyReportPdf, type MonthlySafetyReportRow } from './monthly-safety-pdf'

const spillTemplate = {
  profile: 'biohazard_spill_kit', version: 1, titleTh: 'รายการตรวจ Biohazard Spill Kit',
  supplies: [{ id: 's-1', internalCode: 'GLOVE-01', labelTh: 'ถุงมือใช้แล้วทิ้ง', expiresOn: '2027-12-30' }],
}
const rows: MonthlySafetyReportRow[] = [
  {
    roundItemId: 'round-spill', assetId: 'asset-spill', assetCode: 'SP-01', assetName: 'Spill Kit ห้องรับตัวอย่าง',
    profile: 'biohazard_spill_kit', dueOn: '2026-10-15', submittedAt: '2026-10-08T01:00:00Z', submittedByName: 'ผู้ตรวจ ก',
    status: 'completed', issueCount: 0, templateSnapshot: spillTemplate,
    formSnapshot: { submission: { kind: 'spill_kit', inspectedOn: '2026-10-08', answers: [{ supplyId: 's-1', itemKey: 'glove', result: 'normal', expiresOn: '2027-12-30', note: null }] } },
  },
  {
    roundItemId: 'round-nss', assetId: 'asset-nss', assetCode: 'NSS-01', assetName: 'NSS ห้องเคมี',
    profile: 'nss_eyewash', dueOn: '2026-10-15', submittedAt: '2026-10-09T01:00:00Z', submittedByName: 'ผู้ตรวจ ข',
    status: 'completed', issueCount: 0,
    templateSnapshot: { profile: 'nss_eyewash', version: 1, titleTh: 'แบบตรวจ NSS', supplies: [{ id: 'b-1', internalCode: 'NSS-001', labelTh: 'NSS ขวด 1', manufacturedOrPackedOn: '2026-01-01', purchasedOn: '2026-01-10', expiresOn: '2030-01-01', supplier: 'ผู้ขาย' }] },
    formSnapshot: { submission: { kind: 'nss', bottles: [{ supplyId: 'b-1', clarity: 'clear', bottleCondition: 'intact', correctiveAction: null }] } },
  },
]

async function main() {
  const bytes = await createMonthlySafetyReportPdf({ fiscalYear: 2570, rows })
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF', 'report is a PDF')
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 2, 'spill version and each NSS bottle get their own page')
  assert.ok(bytes.length > 10_000, 'Thai fonts are embedded in the server-generated report')
  console.log('monthly safety PDF passed')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
