import assert from 'node:assert/strict'
import { isPdfSignature, validatePdfMetadata } from './validation'

assert.deepEqual(validatePdfMetadata('minutes.pdf', 'application/pdf', 20 * 1024 * 1024), { ok: true })
assert.deepEqual(validatePdfMetadata('minutes.exe', 'application/pdf', 100), { ok: false, error: 'รองรับเฉพาะไฟล์ PDF' })
assert.deepEqual(validatePdfMetadata('minutes.pdf', 'application/octet-stream', 100), { ok: false, error: 'รองรับเฉพาะไฟล์ PDF' })
assert.deepEqual(validatePdfMetadata('minutes.pdf', 'application/pdf', 20 * 1024 * 1024 + 1), { ok: false, error: 'ไฟล์ PDF ใหญ่เกิน 20 MB' })
assert.equal(isPdfSignature(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true)
assert.equal(isPdfSignature(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), false)

console.log('lib/quality-tasks/validation.test.ts: all assertions passed')
