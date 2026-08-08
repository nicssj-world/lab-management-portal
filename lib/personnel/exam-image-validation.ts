import type { ExamDefinition } from './exam'

export const EXAM_IMAGE_PREFIX = 'personnel-exams/'
export const EXAM_IMAGE_MAX_PER_TARGET = 4
export const EXAM_IMAGE_MAX_BYTES = 2 * 1024 * 1024
export const EXAM_IMAGE_MAX_DIMENSION = 1600

export function isExamImageKey(key: string): boolean {
  return /^personnel-exams\/[^\s]+\.webp$/.test(key)
}

export function validateExamImageUploadMetadata(input: { contentType: string; sizeBytes: number }) {
  if (input.contentType !== 'image/webp') return { ok: false as const, error: 'รองรับเฉพาะรูป WebP หลังบีบอัด' }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0 || input.sizeBytes > EXAM_IMAGE_MAX_BYTES) {
    return { ok: false as const, error: 'ขนาดรูปหลังบีบอัดต้องไม่เกิน 2 MB' }
  }
  return { ok: true as const }
}

export function collectExamImageKeys(definition: ExamDefinition): string[] {
  const keys: string[] = []
  const seen = new Set<string>()
  const add = (key: string) => {
    if (!seen.has(key)) {
      seen.add(key)
      keys.push(key)
    }
  }

  for (const question of definition.questions ?? []) {
    for (const image of question.images ?? []) add(image.key)
    for (const option of question.options ?? []) {
      for (const image of option.images ?? []) add(image.key)
    }
  }
  return keys
}
