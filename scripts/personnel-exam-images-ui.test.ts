import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const dropzone = read('components/personnel/ExamImageDropzone.tsx')
const builder = read('app/(protected)/staff/personnel/exams/ExamsClient.tsx')

for (const required of ['onDrop', 'onPaste', 'onKeyDown', 'aria-live', 'focus-visible', 'type="button"']) {
  assert.ok(dropzone.includes(required), `dropzone must include ${required}`)
}
for (const required of ['ExamImageDropzone', 'รูปคำถาม', 'รูปตัวเลือก', 'uploadExamImage', 'stripExamImageRuntimeUrls']) {
  assert.ok(builder.includes(required), `builder must include ${required}`)
}
assert.ok(builder.includes('disabled={locked}'), 'locked exams must disable image editing')

console.log('personnel exam image UI: contract ok')
