import assert from 'node:assert/strict'
import { createUploadEntry, failedEntryIds, mapRegisterSetOutcomes, retainedUpload, type UploadedFile } from './document-set-upload-model'
import type { Document } from '@/lib/supabase/types'

const mapped = mapRegisterSetOutcomes(['entry-a', 'entry-b', 'entry-c'], {
  succeeded: [{ index: 2 }, { index: 0 }],
  failed: [{ index: 1, error: 'duplicate code' }],
})
assert.deepEqual(Array.from(mapped.entries()), [
  ['entry-c', { status: 'success', reason: '' }],
  ['entry-a', { status: 'success', reason: '' }],
  ['entry-b', { status: 'failed', reason: 'duplicate code' }],
], 'response indices must map back to stable prepared entry IDs')

const missing = mapRegisterSetOutcomes(['entry-a', 'entry-b'], { succeeded: [{ index: 0 }] })
assert.deepEqual(missing.get('entry-b'), {
  status: 'failed', reason: 'เซิร์ฟเวอร์ไม่ส่งผลลัพธ์ของรายการนี้กลับมา',
}, 'an omitted server result must remain safely retryable')

assert.deepEqual(failedEntryIds([
  { id: 'success', submitStatus: 'success' },
  { id: 'failed', submitStatus: 'failed' },
  { id: 'pending', submitStatus: null },
]), ['failed'], 'retry must select only failed entries')

const existing: UploadedFile = { upload_id: '550e8400-e29b-41d4-a716-446655440000', key: 'stable-r2-key', name: 'file.pdf', size: 10, mime: 'application/pdf' }
assert.equal(retainedUpload(undefined, existing), existing, 'ambiguous POST failure must retain the prepared R2 key')
const replacement: UploadedFile = { ...existing, key: 'new-r2-key' }
assert.equal(retainedUpload(replacement, existing), replacement, 'a newly completed upload must replace stale prepared state')

const mainDoc = {
  id: 'main-1', document_code: 'QP-LAB-01', title: 'Main', type: 'QP', department: 'Main department',
  revision: '1', visibility: 'Internal',
} as Document
const entry = createUploadEntry(new File(['x'], 'Fm-BB-01.pdf', { type: 'application/pdf' }), mainDoc)
assert.equal(entry.department, 'Main department', 'member department must default to the main document before code-derived fallback')
