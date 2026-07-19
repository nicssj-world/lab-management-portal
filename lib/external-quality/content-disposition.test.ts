import assert from 'node:assert/strict'
import { contentDispositionForExternalQualityAttachment } from './content-disposition'

const disposition = contentDispositionForExternalQualityAttachment('ใบรับรอง ISO 15189 ฉบับใหม่.pdf')
const headers = new Headers()

assert.doesNotThrow(() => headers.set('Content-Disposition', disposition))
assert.match(disposition, /^inline; filename="[^\x80-\uFFFF]+"; filename\*=UTF-8''/)
assert.match(disposition, /%E0%B9%83%E0%B8%9A/)

console.log('lib/external-quality/content-disposition.test.ts: all assertions passed')
