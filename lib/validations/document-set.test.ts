import assert from 'node:assert/strict'
import test from 'node:test'
import { RegisterSetSchema } from './document-set'

const uploadId = '550e8400-e29b-41d4-a716-446655440000'
const validFile = {
  upload_id: uploadId,
  key: 'documents/sets/main-1/2026/file.pdf',
  name: 'file.pdf',
  size: 50 * 1024 * 1024,
  mime: 'application/pdf',
}
const validRegister = {
  kind: 'register' as const,
  file: validFile,
  document_code: ' FM-01 ',
  title: ' Form title ',
  type: 'Form' as const,
  department: 'Lab',
  revision: '1',
  owner_name: 'Owner',
  reviewer_name: 'Reviewer',
  approver_name: 'Approver',
  edit_date: '2026-07-13',
  effective_date: '',
  visibility: 'Internal' as const,
}

test('register set validation trims required fields and accepts exactly 50 MB', () => {
  const parsed = RegisterSetSchema.parse({ items: [validRegister] })
  assert.equal(parsed.items[0].kind, 'register')
  if (parsed.items[0].kind === 'register') {
    assert.equal(parsed.items[0].document_code, 'FM-01')
    assert.equal(parsed.items[0].title, 'Form title')
    assert.equal(parsed.items[0].file.size, 50 * 1024 * 1024)
  }
})

test('register set validation rejects invalid upload ids, oversize files, dates, and length boundaries', () => {
  const invalidCases = [
    { ...validRegister, file: { ...validFile, upload_id: 'not-a-uuid' } },
    { ...validRegister, file: { ...validFile, size: 50 * 1024 * 1024 + 1 } },
    { ...validRegister, edit_date: '2026-02-30' },
    { ...validRegister, document_code: 'X'.repeat(51) },
    { ...validRegister, title: 'X'.repeat(201) },
    { ...validRegister, revision: 'X'.repeat(31) },
    { ...validRegister, owner_name: 'X'.repeat(201) },
  ]

  for (const item of invalidCases) assert.equal(RegisterSetSchema.safeParse({ items: [item] }).success, false)
})

test('every file-bearing item requires a nonempty upload ticket and metadata', () => {
  assert.equal(RegisterSetSchema.safeParse({ items: [{ kind: 'attach', file: validFile }] }).success, true)
  assert.equal(RegisterSetSchema.safeParse({ items: [{ kind: 'attach', file: { ...validFile, name: '   ' } }] }).success, false)
  assert.equal(RegisterSetSchema.safeParse({ items: [{ kind: 'attach', file: { ...validFile, mime: '' } }] }).success, false)
  assert.equal(RegisterSetSchema.safeParse({ items: [{ kind: 'revise-existing', existing_document_id: uploadId, file: validFile }] }).success, true)
})
