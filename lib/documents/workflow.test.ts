import assert from 'node:assert/strict'
import { isReadableDocument } from './workflow'

assert.equal(isReadableDocument({ status: 'Published', file_url: 'documents/wi/current.pdf' }), true)
assert.equal(isReadableDocument({ status: 'Draft', file_url: 'documents/wi/draft.pdf' }), false)
assert.equal(isReadableDocument({ status: 'Published', file_url: null }), false)

console.log('document workflow read eligibility tests passed')
