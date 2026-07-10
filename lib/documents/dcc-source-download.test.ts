import assert from 'node:assert/strict'
import {
  buildDccSourceDownloadFilename,
  buildDccSourceDownloadSummary,
  planDccSourceZip,
  type DccSourceDraft,
} from './dcc-source-download'

function draft(overrides: Partial<DccSourceDraft>): DccSourceDraft {
  return {
    draftId: 'draft-1',
    documentId: 'doc-1',
    documentCode: 'WI-CHEM-001',
    title: 'Chemistry Work Instruction',
    revision: '02',
    wordUrl: 'documents/wi/source.docx',
    wordName: 'source.docx',
    wordSize: 200,
    ...overrides,
  }
}

const complete = draft({})
const noSource = draft({
  draftId: 'draft-2',
  documentId: 'doc-2',
  documentCode: 'WI-CHEM-002',
  title: 'Missing Source',
  wordUrl: null,
  wordName: null,
  wordSize: null,
})

const sourcePlan = planDccSourceZip([complete, noSource])
assert.deepEqual(sourcePlan.entries.map((entry) => entry.zipPath), [
  'Word-Excel/WI-CHEM-001 Chemistry Work Instruction.docx',
])
assert.equal(sourcePlan.entries[0]?.draftId, 'draft-1')
assert.equal(sourcePlan.skipped.length, 1)
assert.equal(sourcePlan.skipped[0]?.reason, 'missing-source')
assert.equal(sourcePlan.estimatedBytes, 200)
assert.equal(sourcePlan.matchedDrafts, 2)

const warningPlan = planDccSourceZip([draft({ wordSize: 201 * 1024 * 1024 })])
assert.equal(warningPlan.warning?.code, 'large-download')

assert.throws(
  () => planDccSourceZip([draft({ wordSize: 301 * 1024 * 1024 })]),
  /300 MB/,
)

assert.throws(
  () => planDccSourceZip(Array.from({ length: 101 }, (_, i) => draft({ draftId: `draft-${i}`, documentCode: `WI-${i}` }))),
  /100 รายการ/,
)

const summary = buildDccSourceDownloadSummary(sourcePlan)
assert.match(summary, /DCC source download summary/)
assert.match(summary, /Matched drafts: 2/)
assert.match(summary, /Exported files: 1/)
assert.match(summary, /Skipped files: 1/)
assert.match(summary, /WI-CHEM-002 Missing Source: missing Word\/Excel/)

assert.equal(buildDccSourceDownloadFilename(new Date('2026-07-10T12:00:00.000Z')), 'dcc-source-files-2026-07-10.zip')
