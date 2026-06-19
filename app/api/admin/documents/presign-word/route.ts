import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requiredEnv } from '@/lib/env'
import { getActor, canAccessDocuments } from '@/lib/auth/guards'
import { isSourceFile } from '@/lib/documents/workflow'

const MAX_WORD_FILE_SIZE = 50 * 1024 * 1024

let cachedR2: S3Client | null = null
function getR2Client() {
  if (!cachedR2) {
    cachedR2 = new S3Client({
      region: 'auto',
      endpoint: `https://${requiredEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: requiredEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: requiredEnv('R2_SECRET_ACCESS_KEY'),
      },
    })
  }
  return cachedR2
}

function inferredContentType(filename: string, contentType: string | null | undefined) {
  if (contentType?.trim() && contentType !== 'application/octet-stream') return contentType.trim()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Returns a presigned PUT URL so the browser can upload word/excel source files
// directly to R2, bypassing Vercel's 4.5 MB API-route body-size limit.
export async function GET(req: NextRequest) {
  try {
    const actor = await getActor()
    if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    if (!(await canAccessDocuments(actor, 'edit'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const sp = req.nextUrl.searchParams
    const fileName = (sp.get('fileName') ?? '').trim()
    const fileType = inferredContentType(fileName, sp.get('fileType'))
    const fileSize = Number(sp.get('fileSize') ?? '')
    const docType = (sp.get('docType') ?? 'others').toLowerCase().replace(/[^a-z]/g, '')

    if (!fileName) return NextResponse.json({ error: 'ต้องระบุชื่อไฟล์' }, { status: 422 })
    if (!isSourceFile({ name: fileName })) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับรองรับ DOC, DOCX, XLS, XLSX เท่านั้น' }, { status: 422 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_WORD_FILE_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ต้นฉบับใหญ่เกิน 50 MB' }, { status: 422 })
    }

    const year = new Date().getFullYear()
    const safeName = safeStorageName(fileName)
    const key = `documents/${docType}/${year}/${Date.now()}-source-${safeName}`
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: requiredEnv('R2_BUCKET_NAME'),
        Key: key,
        ContentType: fileType,
      }),
      { expiresIn: 300 },
    )
    return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' },
      { status: 500 },
    )
  }
}
