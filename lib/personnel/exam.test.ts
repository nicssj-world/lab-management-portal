import assert from 'node:assert/strict'
import {
  ExamDefinitionSchema,
  definitionForTaking,
  stripExamImageRuntimeUrls,
  type ExamDefinitionView,
} from './exam'

const image = { id: 'img-1', key: 'personnel-exams/user-1/img-1.webp', alt: 'ภาพตัวอย่าง', width: 1200, height: 800 }

const imageOnly = {
  questions: [{
    id: 'q-1', prompt: '', type: 'single_choice' as const, images: [image],
    options: [
      { id: 'o-1', label: '', isCorrect: true, images: [image] },
      { id: 'o-2', label: 'ตัวเลือกสอง', isCorrect: false, images: [] },
    ],
  }],
}

const parsed = ExamDefinitionSchema.safeParse(imageOnly)
assert.equal(parsed.success, true, 'image-only question and option must be valid')
assert.equal(parsed.success && parsed.data.questions[0].images.length, 1)

const tooMany = {
  ...imageOnly,
  questions: [{ ...imageOnly.questions[0], images: Array.from({ length: 5 }, (_, i) => ({ ...image, id: `img-${i}` })) }],
}
assert.equal(ExamDefinitionSchema.safeParse(tooMany).success, false, 'a target must reject a fifth image')

const twoCorrect = {
  ...imageOnly,
  questions: [{ ...imageOnly.questions[0], options: imageOnly.questions[0].options.map((o) => ({ ...o, isCorrect: true })) }],
}
assert.equal(ExamDefinitionSchema.safeParse(twoCorrect).success, false, 'a question must have exactly one correct option')

const taking = definitionForTaking(parsed.success ? parsed.data : imageOnly)
assert.deepEqual(taking.questions[0].images, [image])
assert.deepEqual(taking.questions[0].options[0].images, [image])
assert.equal(taking.questions[0].options[0].isCorrect, false)

const runtime: ExamDefinitionView = {
  ...imageOnly,
  questions: imageOnly.questions.map((q) => ({
    ...q,
    images: q.images.map((item) => ({ ...item, url: 'https://signed.example/image' })),
    options: q.options.map((o) => ({ ...o, images: o.images.map((item) => ({ ...item, url: 'https://signed.example/option' })) })),
  })),
}
const persisted = stripExamImageRuntimeUrls(runtime)
const persistedQuestionImage = persisted.questions[0].images?.[0]
const persistedOptionImage = persisted.questions[0].options[0].images?.[0]
assert.ok(persistedQuestionImage)
assert.ok(persistedOptionImage)
assert.equal('url' in persistedQuestionImage, false)
assert.equal('url' in persistedOptionImage, false)

console.log('personnel exam definition: ok')
