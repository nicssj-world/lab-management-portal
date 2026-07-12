import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'
import { safePdfName, validatePdfMetadata } from '@/lib/quality-tasks/validation'

const schema = z.object({ instanceId: z.string().uuid(), fileName: z.string().min(1), contentType: z.string(), sizeBytes: z.number().int().positive() })

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const input = schema.parse(await req.json()); await getOccurrenceAccess(input.instanceId, ctx.actor, ctx.level)
    const check = validatePdfMetadata(input.fileName, input.contentType, input.sizeBytes); if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 })
    const key = `quality-tasks/${input.instanceId}/${crypto.randomUUID()}-${safePdfName(input.fileName)}`
    const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: 'application/pdf' }), { expiresIn: 300 })
    return NextResponse.json({ uploadUrl, key, contentType: 'application/pdf' })
  } catch (error) { return qualityTaskError(error) }
}

