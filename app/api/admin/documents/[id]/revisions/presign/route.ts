import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'

const MAX_HISTORY_FILE_SIZE = 50 * 1024 * 1024
const ALLOWED_HISTORY_FILE_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx'])

function canBackfillRevisionHistory(actor: { role: string; doc_role: string | null }) {
  return actor.role === 'Admin' || actor.role === 'Document Controller' || actor.doc_role === 'Document Controller'
}

function inferredContentType(filename: string, contentType: string | null | undefined) {
  if (contentType?.trim() && contentType !== 'application/octet-stream') return contentType.trim()
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  return 'application/octet-stream'
}

function safeStorageName(filename: string) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_')
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  if (!canBackfillRevisionHistory(actor)) return jsonForbidden()

  const { id } = await params
  const sp = req.nextUrl.searchParams
  const fileName = (sp.get('fileName') ?? '').trim()
  const fileType = inferredContentType(fileName, sp.get('fileType'))
  const fileSize = Number(sp.get('fileSize') ?? '')

  if (!fileName) return NextResponse.json({ error: 'ต้องระบุชื่อไฟล์' }, { status: 422 })
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (!ALLOWED_HISTORY_FILE_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
  }
  if (Number.isFinite(fileSize) && fileSize > MAX_HISTORY_FILE_SIZE) {
    return NextResponse.json({ error: 'ไฟล์ประวัติย้อนหลังใหญ่เกิน 50 MB' }, { status: 422 })
  }

  const key = `documents/revisions/backfill/${id}/${Date.now()}-${safeStorageName(fileName)}`
  const uploadUrl = await getSignedUrl(
    r2,
    new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: fileType }),
    { expiresIn: 300 },
  )
  return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: fileType })
}
