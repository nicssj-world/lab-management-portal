import assert from 'node:assert/strict'
import { pickReleaseRows } from './release'

// no rows at all
assert.deepEqual(pickReleaseRows([]), { printRow: null, managedRow: null })

// draft only
const draftOnly = [{ status: 'draft', created_at: '2026-01-01' }]
assert.deepEqual(pickReleaseRows(draftOnly), { printRow: draftOnly[0], managedRow: draftOnly[0] })

// published only
const publishedOnly = [{ status: 'published', created_at: '2026-01-01' }]
assert.deepEqual(pickReleaseRows(publishedOnly), { printRow: publishedOnly[0], managedRow: publishedOnly[0] })

// both present — this is the case the original bug got wrong: the print catalog must prefer
// published (so a draft is never printed as "official"), the panel must prefer the draft
// (so a newly created draft is reachable for editing even though something is already published)
const published = { status: 'published', created_at: '2026-01-01' }
const draft = { status: 'draft', created_at: '2026-06-01' } // newer than the published row
const both = pickReleaseRows([published, draft])
assert.equal(both.printRow, published, 'the print/export catalog must always use the published release when one exists')
assert.equal(both.managedRow, draft, 'the management panel must always surface an in-progress draft over an already-published release')

console.log('lab map release row selection tests passed')
