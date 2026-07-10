import assert from 'node:assert/strict'
import {
  buildBulkDownloadFilename,
  buildBulkDownloadQuery,
  buildDownloadSummary,
  canUseBulkDocumentDownload,
  planDocumentZip,
  type BulkDownloadDocument,
} from './bulk-download'

function doc(overrides: Partial<BulkDownloadDocument>): BulkDownloadDocument {
  return {
    id: 'doc-1',
    document_code: 'WI-CHEM-001',
    title: 'Chemistry Work Instruction',
    type: 'WI',
    department: 'เคมี',
    status: 'Published',
    visibility: 'Internal',
    file_url: 'documents/wi/official.pdf',
    file_name: 'official.pdf',
    file_size: 100,
    word_url: 'documents/wi/source.docx',
    word_name: 'source.docx',
    word_size: 200,
    ...overrides,
  }
}

const complete = doc({})
const noPdf = doc({ id: 'doc-2', document_code: 'WI-CHEM-002', title: 'No PDF', file_url: null, file_name: null, file_size: null })
const noSource = doc({ id: 'doc-3', document_code: 'WI-CHEM-003', title: 'No Source', word_url: null, word_name: null, word_size: null })

const pdfPlan = planDocumentZip([complete, noPdf], { kind: 'pdf' })
assert.deepEqual(pdfPlan.entries.map((entry) => entry.zipPath), ['PDF/WI-CHEM-001 Chemistry Work Instruction.pdf'])
assert.equal(pdfPlan.skipped.length, 1)
assert.equal(pdfPlan.skipped[0]?.reason, 'missing-pdf')
assert.equal(pdfPlan.estimatedBytes, 100)

const sourcePlan = planDocumentZip([complete, noSource], { kind: 'source' })
assert.deepEqual(sourcePlan.entries.map((entry) => entry.zipPath), ['Word-Excel/WI-CHEM-001 Chemistry Work Instruction.docx'])
assert.equal(sourcePlan.skipped[0]?.reason, 'missing-source')
assert.equal(sourcePlan.estimatedBytes, 200)

const bothPlan = planDocumentZip([complete], { kind: 'both' })
assert.deepEqual(bothPlan.entries.map((entry) => entry.zipPath), [
  'PDF/WI-CHEM-001 Chemistry Work Instruction.pdf',
  'Word-Excel/WI-CHEM-001 Chemistry Work Instruction.docx',
])
assert.equal(bothPlan.warning, null)

const warningPlan = planDocumentZip([doc({ file_size: 201 * 1024 * 1024, word_size: 1 })], { kind: 'pdf' })
assert.equal(warningPlan.warning?.code, 'large-download')

assert.throws(
  () => planDocumentZip([doc({ file_size: 301 * 1024 * 1024, word_size: 1 })], { kind: 'pdf' }),
  /300 MB/,
)

assert.throws(
  () => planDocumentZip(Array.from({ length: 101 }, (_, i) => doc({ id: `doc-${i}`, document_code: `WI-${i}` })), { kind: 'pdf' }),
  /100 เอกสาร/,
)

const summary = buildDownloadSummary(bothPlan, {
  type: 'WI',
  department: 'เคมี',
  search: 'glucose',
  visibility: 'Internal',
})
assert.match(summary, /Matched documents: 1/)
assert.match(summary, /Exported files: 2/)
assert.match(summary, /Status: Published/)
assert.match(summary, /Department: เคมี/)

assert.equal(buildBulkDownloadFilename({ type: 'WI', department: 'เคมี' }), 'documents-export-เคมี-WI.zip')
assert.deepEqual(buildBulkDownloadQuery({ type: 'WI', department: 'เคมี', search: 'abc', visibility: 'Internal' }), {
  type: 'WI',
  department: 'เคมี',
  search: 'abc',
  visibility: 'Internal',
  status: 'Published',
})

assert.equal(canUseBulkDocumentDownload({ role: 'Admin', doc_role: null }), true)
assert.equal(canUseBulkDocumentDownload({ role: 'Staff', doc_role: 'Document Controller' }), true)
assert.equal(canUseBulkDocumentDownload({ role: 'Staff', doc_role: 'Reviewer' }), true)
assert.equal(canUseBulkDocumentDownload({ role: 'Staff', doc_role: 'Viewer' }), false)
