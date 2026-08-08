import assert from 'node:assert/strict'
import {
  EXAM_IMAGE_MAX_BYTES,
  EXAM_IMAGE_MAX_PER_TARGET,
  collectExamImageKeys,
  isExamImageKey,
  validateExamImageUploadMetadata,
} from './exam-image-validation'

assert.equal(EXAM_IMAGE_MAX_PER_TARGET, 4)
assert.equal(isExamImageKey('personnel-exams/user-1/a.webp'), true)
assert.equal(isExamImageKey('../private/a.webp'), false)
assert.equal(isExamImageKey('personnel-exams/user-1/a.png'), false)

assert.deepEqual(validateExamImageUploadMetadata({ contentType: 'image/webp', sizeBytes: 1000 }), { ok: true })
assert.equal(validateExamImageUploadMetadata({ contentType: 'image/png', sizeBytes: 1000 }).ok, false)
assert.equal(validateExamImageUploadMetadata({ contentType: 'image/webp', sizeBytes: EXAM_IMAGE_MAX_BYTES + 1 }).ok, false)

const definition = {
  questions: [{
    id: 'q', prompt: 'x', type: 'single_choice' as const,
    images: [{ id: 'q-img', key: 'personnel-exams/u/q.webp', alt: '', width: 1, height: 1 }],
    options: [
      { id: 'a', label: 'a', isCorrect: true, images: [{ id: 'a-img', key: 'personnel-exams/u/a.webp', alt: '', width: 1, height: 1 }] },
      { id: 'b', label: 'b', isCorrect: false, images: [] },
    ],
  }],
}
assert.deepEqual(collectExamImageKeys(definition), ['personnel-exams/u/q.webp', 'personnel-exams/u/a.webp'])

console.log('exam image validation: ok')
