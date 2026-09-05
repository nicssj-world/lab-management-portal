import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/documents/DocumentUploadModal.tsx', 'utf8')
const headerStart = source.indexOf('{/* Header */}')
const bodyStart = source.indexOf('{/* Body */}')
const headerCloseStart = source.indexOf('aria-label="ปิดหน้าต่างสร้างเอกสาร"')
const headerCloseEnd = source.indexOf('</button>', headerCloseStart)
const footerStart = source.indexOf('{/* Footer */}')
const saveActionStart = source.indexOf('บันทึกเป็น Draft', footerStart)
const header = source.slice(headerStart, bodyStart)
const footerBeforeSave = source.slice(footerStart, saveActionStart)

assert.notEqual(headerStart, -1, 'the modal should keep its header')
assert.notEqual(bodyStart, -1, 'the modal should keep its body')
assert.match(header, /position: 'sticky'/, 'the header should remain visible while the modal content scrolls')
assert.match(header, /top: 0/, 'the sticky header should attach to the top of the modal scroll area')
assert.match(header, /zIndex: 10/, 'the sticky header should stay above scrolling form content')
assert.notEqual(headerCloseStart, -1, 'the modal should keep an accessible header close control')
assert.notEqual(headerCloseEnd, -1, 'the header close control should render as a button')
assert.match(
  source.slice(headerCloseStart, headerCloseEnd),
  /var\(--danger\)/,
  'the header close control should use the danger color',
)
assert.match(
  source.slice(headerCloseStart, headerCloseEnd),
  /width: 44, height: 44/,
  'the header close control should have a touch-friendly target',
)

assert.notEqual(footerStart, -1, 'the modal should keep its action footer')
assert.notEqual(saveActionStart, -1, 'the action footer should keep the save draft action')
assert.match(
  footerBeforeSave,
  /ยกเลิก/,
  'the bottom cancel action should remain unchanged',
)
assert.doesNotMatch(footerBeforeSave, /variant="danger"/, 'the bottom cancel action should not be changed')

console.log('document upload close action test passed')
