import 'server-only'

import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import {
  normalizeExamDefinition,
  type ExamDefinition,
  type ExamDefinitionView,
  type ExamImage,
  type ExamImageView,
} from './exam'
import {
  EXAM_IMAGE_MAX_BYTES,
  EXAM_IMAGE_PREFIX,
  isExamImageKey,
  validateExamImageUploadMetadata,
} from './exam-image-validation'

export type ExamImageUploadMetadata = { contentType: string; sizeBytes: number }

export function examImageActorPrefix(actorId: string): string {
  return `${EXAM_IMAGE_PREFIX}${actorId}/`
}

export async function presignExamImage(actorId: string, input: ExamImageUploadMetadata) {
  const check = validateExamImageUploadMetadata(input)
  if (!check.ok) throw new Error(check.error)
  const key = `${examImageActorPrefix(actorId)}${crypto.randomUUID()}.webp`
  const [uploadUrl, readUrl] = await Promise.all([
    getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: 'image/webp' }), { expiresIn: 300 }),
    getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 }),
  ])
  return { key, uploadUrl, readUrl, contentType: 'image/webp' as const }
}

export async function signExamImage(key: string): Promise<string> {
  if (!isExamImageKey(key)) throw new Error('เส้นทางรูปข้อสอบไม่ถูกต้อง')
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }), { expiresIn: 3600 })
}

export async function verifyExamImageKeys(keys: string[], options?: { ownerPrefix?: string; trustedKeys?: Iterable<string> }): Promise<void> {
  const trustedKeys = new Set(options?.trustedKeys ?? [])
  for (const key of [...new Set(keys)]) {
    if (!isExamImageKey(key)) throw new Error('เส้นทางรูปข้อสอบไม่ถูกต้อง')
    if (options?.ownerPrefix && !key.startsWith(options.ownerPrefix) && !trustedKeys.has(key)) {
      throw new Error('ไม่มีสิทธิ์ใช้รูปข้อสอบนี้')
    }
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    const check = validateExamImageUploadMetadata({ contentType: head.ContentType ?? '', sizeBytes: Number(head.ContentLength ?? 0) })
    if (!check.ok) throw new Error(check.error)
  }
}

export async function deleteExamImageKeys(keys: string[]): Promise<void> {
  const validKeys = [...new Set(keys)]
  if (validKeys.some((key) => !isExamImageKey(key))) throw new Error('เส้นทางรูปข้อสอบไม่ถูกต้อง')
  await Promise.all(validKeys.map((key) => r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))))
}

export function hydrateExamImage(image: ExamImage, url: string) {
  return { ...image, url }
}

async function hydrateExamImages(images: ExamImage[]): Promise<ExamImageView[]> {
  return Promise.all(images.map(async (image) => hydrateExamImage(image, await signExamImage(image.key))))
}

export async function hydrateExamDefinitionImages(definition: ExamDefinition): Promise<ExamDefinitionView> {
  const normalized = normalizeExamDefinition(definition)
  return {
    ...normalized,
    questions: await Promise.all(normalized.questions.map(async (question) => ({
      ...question,
      images: await hydrateExamImages(question.images ?? []),
      options: await Promise.all(question.options.map(async (option) => ({
        ...option,
        images: await hydrateExamImages(option.images ?? []),
      }))),
    }))),
  }
}
