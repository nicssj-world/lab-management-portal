import assert from 'node:assert/strict'
import { fileKind, isAllowedFileSignature, safeExternalQualityFileName, validateExternalQualityFile } from './files'

assert.deepEqual(validateExternalQualityFile('certificate.pdf', 'application/pdf', 1024), { ok: true, kind: 'pdf' })
assert.deepEqual(validateExternalQualityFile('scope.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 1024), { ok: true, kind: 'excel' })
assert.equal(validateExternalQualityFile('script.exe', 'application/octet-stream', 100).ok, false)
assert.equal(validateExternalQualityFile('empty.pdf', 'application/pdf', 0).ok, false)
assert.equal(validateExternalQualityFile('large.pdf', 'application/pdf', 20 * 1024 * 1024 + 1).ok, false)

assert.equal(fileKind('image/jpeg'), 'image')
assert.equal(isAllowedFileSignature('application/pdf', new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])), true)
assert.equal(isAllowedFileSignature('image/png', new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true)
assert.equal(isAllowedFileSignature('application/pdf', new Uint8Array([0, 1, 2, 3, 4])), false)
assert.equal(safeExternalQualityFileName('ใบรับรอง ISO 15189 (ฉบับใหม่).pdf').endsWith('.pdf'), true)

console.log('lib/external-quality/files.test.ts: all assertions passed')
