import { createHash } from 'node:crypto'

import {
  stampUncontrolledPdf,
  UNCONTROLLED_TRANSFORM_VERSION,
  type DeliveryVariant,
} from '@/lib/documents/uncontrolled-pdf'

export type CacheableDocument = {
  id: string
  file_url: string
  file_name: string | null
  mime_type: string | null
  type: string
  status: string
}

type CachedObject = { size: number; metadata: Record<string, string> }

export type UncontrolledPdfCacheDependencies = {
  head(key: string): Promise<CachedObject | null>
  get(key: string): Promise<Uint8Array>
  put(key: string, bytes: Uint8Array, metadata: Record<string, string>): Promise<void>
  stamp(source: Uint8Array, input: { variant: DeliveryVariant; downloadDate: string }): Promise<{ bytes: Uint8Array }>
}

function bangkokDate(now: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(now)
}

function derivativeKey(documentId: string, variant: DeliveryVariant) {
  const root = `documents/uncontrolled/${documentId}`
  return variant === 'preview' ? `${root}/preview.pdf` : `${root}/download-current.pdf`
}

function sourceKeySha256(sourceKey: string) {
  return createHash('sha256').update(sourceKey).digest('hex')
}

function matchingMetadata(actual: Record<string, string>, expected: Record<string, string>) {
  const normalized = Object.fromEntries(Object.entries(actual).map(([key, value]) => [key.toLowerCase(), value]))
  return Object.entries(expected).every(([key, value]) => normalized[key.toLowerCase()] === value)
}

async function defaultDependencies(): Promise<UncontrolledPdfCacheDependencies> {
  const [{ r2, R2_BUCKET }, { GetObjectCommand, HeadObjectCommand, PutObjectCommand }] = await Promise.all([
    import('@/lib/r2/client'),
    import('@aws-sdk/client-s3'),
  ])

  return {
    async head(key) {
      try {
        const object = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
        return { size: object.ContentLength ?? 0, metadata: object.Metadata ?? {} }
      } catch (error) {
        const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        if (status === 404) return null
        throw error
      }
    },
    async get(key) {
      const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      if (!object.Body || typeof object.Body.transformToByteArray !== 'function') {
        throw new Error('ไม่สามารถอ่านไฟล์ต้นฉบับจาก R2 ได้')
      }
      return object.Body.transformToByteArray()
    },
    async put(key, bytes, metadata) {
      await r2.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: 'application/pdf',
        Metadata: metadata,
      }))
    },
    stamp: stampUncontrolledPdf,
  }
}

export async function resolveUncontrolledPdf(
  document: CacheableDocument,
  variant: DeliveryVariant,
  now: Date,
  dependencies?: UncontrolledPdfCacheDependencies,
) {
  const store = dependencies ?? await defaultDependencies()
  const downloadDate = variant === 'download' ? bangkokDate(now) : null
  const key = derivativeKey(document.id, variant)
  const metadata: Record<string, string> = {
    'source-key-sha256': sourceKeySha256(document.file_url),
    'transform-version': UNCONTROLLED_TRANSFORM_VERSION,
    variant,
  }
  if (downloadDate) metadata['download-date'] = downloadDate

  const existing = await store.head(key)
  if (existing && matchingMetadata(existing.metadata, metadata)) {
    return { key, cacheStatus: 'hit' as const, downloadDate, size: existing.size }
  }

  const source = await store.get(document.file_url)
  const output = await store.stamp(source, { variant, downloadDate: downloadDate ?? bangkokDate(now) })
  await store.put(key, output.bytes, metadata)

  return {
    key,
    cacheStatus: (existing ? 'regenerated' : 'generated') as 'generated' | 'regenerated',
    downloadDate,
    size: output.bytes.byteLength,
  }
}
