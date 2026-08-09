import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { z } from 'zod'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { safeExternalQualityFileName } from '@/lib/external-quality/files'
import { validateSafetyEvidenceMetadata } from '@/lib/quality-tasks/safety'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getOccurrenceAccess } from '@/lib/quality-tasks/server'

const schema = z.object({ instanceId: z.string().uuid(), fileName: z.string().min(1).max(255), contentType: z.string(), sizeBytes: z.number().int().positive() })

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const input = schema.parse(await req.json())
    await getOccurrenceAccess(input.instanceId, ctx.actor, ctx.level, 'safety')
    const check = validateSafetyEvidenceMetadata(input.fileName, input.contentType, input.sizeBytes)
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 422 })
    const key = `safety-tasks/${input.instanceId}/${crypto.randomUUID()}-${safeExternalQualityFileName(input.fileName)}`
    const uploadUrl = await getSignedUrl(r2, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: input.contentType }), { expiresIn: 300 })
    return NextResponse.json({ uploadUrl, key, contentType: input.contentType })
  } catch (error) { return safetyTaskError(error) }
}
