import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/documents/DocumentUploadModal.tsx', 'utf8')
const progressStart = source.indexOf('{uploadProgress !== null && (')
const lastExtractButton = source.lastIndexOf('ดึงข้อมูล</>')
const footerStart = source.indexOf('{/* Footer */}')

assert.notEqual(progressStart, -1, 'document upload modal should render upload progress')
assert.notEqual(lastExtractButton, -1, 'document upload modal should keep the data extraction buttons')
assert.notEqual(footerStart, -1, 'document upload modal should keep its action footer')
assert.ok(
  lastExtractButton < progressStart && progressStart < footerStart,
  'upload progress should be rendered after the data extraction buttons and before the save footer',
)

console.log('document upload progress position test passed')
