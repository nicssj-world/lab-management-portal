import assert from 'node:assert/strict'
import {
  createUploadEntry,
  entryLabel,
  failedEntryIds,
  formatDocumentSetUploadCompletion,
  mapBatchUploadFailureOutcomes,
  mapRegisterSetOutcomes,
  mapRegisterSetValidationOutcomes,
  registrationError,
  retainedUpload,
  type UploadedFile,
} from './document-set-upload-model'
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

const batchUploadFailures = mapBatchUploadFailureOutcomes(
  ['entry-a', 'entry-b', 'entry-c'],
  new Map([['entry-b', 'network error']]),
)
assert.deepEqual(Array.from(batchUploadFailures.entries()), [
  ['entry-a', { status: 'failed', reason: 'ชุดเอกสารนี้ยังไม่ได้บันทึก เนื่องจากมีรายการหนึ่งไม่ผ่านการอัปโหลดหรือการตรวจสอบ' }],
  ['entry-b', { status: 'failed', reason: 'network error' }],
  ['entry-c', { status: 'failed', reason: 'ชุดเอกสารนี้ยังไม่ได้บันทึก เนื่องจากมีรายการหนึ่งไม่ผ่านการอัปโหลดหรือการตรวจสอบ' }],
], 'one upload failure must make every selected entry retryable and unsaved')

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

const codedEntry = createUploadEntry(
  new File(['x'], 'RF-WI-T-BM02-15 เอกสารกำกับน้ำยา CD5 FITC.pdf', { type: 'application/pdf' }),
  mainDoc,
)
assert.equal(
  entryLabel(codedEntry),
  'RF-WI-T-BM02-15 เอกสารกำกับน้ำยา CD5 FITC.pdf',
  'the confirmation label must not repeat a document code already present at the start of the filename',
)

const validEntry = { ...entry, code: 'FM-BB-01', title: 'Form title', duplicate: { status: 'none' as const } }
assert.equal(registrationError(validEntry), '', 'a separated code and title must remain valid')
assert.match(registrationError({ ...validEntry, code: 'X'.repeat(51) }), /รหัสเอกสารยาวเกิน 50/, 'the upload form must catch an overlong document code before submit')
assert.match(registrationError({ ...validEntry, code: 'FM-BB-01', title: 'FM-BB-01' }), /เว้นวรรค/, 'the upload form must explain the required filename separator')

const validationOutcomes = mapRegisterSetValidationOutcomes(['entry-valid', 'entry-invalid'], [{
  index: 1,
  field: 'document_code',
  message: 'String must contain at most 50 character(s)',
}])
assert.match(validationOutcomes.get('entry-invalid')?.reason ?? '', /รหัสเอกสารยาวเกิน 50/, 'the invalid row must receive the field-specific error')
assert.match(validationOutcomes.get('entry-valid')?.reason ?? '', /รายการอื่นในชุดไม่ผ่าน/, 'valid rows must explain that the batch was not saved')

assert.deepEqual(
  formatDocumentSetUploadCompletion({ successfulCount: 3, failedCount: 0 }),
  { message: 'อัปโหลดและบันทึกชุดเอกสารสำเร็จแล้ว 3 รายการ', ok: true },
  'an all-success batch must produce a clear success toast',
)
assert.deepEqual(
  formatDocumentSetUploadCompletion({ successfulCount: 1, failedCount: 2 }),
  { message: 'ดำเนินการชุดเอกสารแล้ว: สำเร็จ 1 รายการ · ไม่สำเร็จ 2 รายการ', ok: false },
  'a partial batch must report both successful and failed counts without claiming success',
)
