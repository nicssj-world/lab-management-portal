import { NextRequest, NextResponse } from 'next/server'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { requiredEnv } from '@/lib/env'
import { getActor, canAccessDocuments } from '@/lib/auth/guards'
import { isCoverRequiredType, isPdfFile, isSourceFile } from '@/lib/documents/workflow'
import {
  canonicalSetFileMime,
  registrationSetStoragePrefix,
  validateSetUploadFile,
  type SetUploadKind,
} from '@/lib/documents/registration-set-contracts'
import { cleanupExpiredSetUploads } from '@/lib/documents/set-upload-cleanup'
import { supabaseAdmin } from '@/lib/supabase/admin'

const MAX_OFFICIAL_FILE_SIZE = 50 * 1024 * 1024
const SET_UPLOAD_CLAIM_TTL_MS = 60 * 60 * 1000

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

// Returns a presigned PUT URL so the browser can upload the official document file
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
    const docType = (sp.get('type') ?? 'others').trim()
    const mainDocumentId = (sp.get('mainDocumentId') ?? '').trim()
    const rawSetItemKind = (sp.get('setItemKind') ?? '').trim()
    const isSetRequest = Boolean(mainDocumentId || rawSetItemKind)
    const setItemKind = rawSetItemKind as SetUploadKind
    const isAttachment = setItemKind === 'attach' || sp.get('kind') === 'attachment'

    if (!fileName) return NextResponse.json({ error: 'ต้องระบุชื่อไฟล์' }, { status: 422 })
    if (isSetRequest && (!Number.isInteger(fileSize) || fileSize < 0)) {
      return NextResponse.json({ error: 'ขนาดไฟล์ไม่ถูกต้อง' }, { status: 422 })
    }
    if (isSetRequest) {
      if (!mainDocumentId || !['register', 'attach', 'revise-existing'].includes(setItemKind)) {
        return NextResponse.json({ error: 'set upload ต้องระบุ mainDocumentId และ setItemKind ที่ถูกต้อง' }, { status: 422 })
      }
      const mainResult = await supabaseAdmin
        .from('documents')
        .select('id, status')
        .eq('id', mainDocumentId)
        .is('deleted_at', null)
        .maybeSingle()
      if (mainResult.error) throw mainResult.error
      if (!mainResult.data) return NextResponse.json({ error: 'ไม่พบเอกสารหลัก' }, { status: 404 })
      if (mainResult.data.status !== 'Draft') {
        return NextResponse.json({ error: 'อัปโหลดไฟล์ชุดได้เฉพาะเอกสารหลักสถานะ Draft' }, { status: 409 })
      }
      void cleanupExpiredSetUploads(10).catch((error) => {
        console.error('Expired set upload cleanup failed', { error: error instanceof Error ? error.message : String(error) })
      })
    }

    const resolvedFileType = isSetRequest && !isAttachment
      ? canonicalSetFileMime(fileName) ?? fileType
      : fileType
    const fileRef = { name: fileName, type: resolvedFileType }
    const coverRequired = isCoverRequiredType(docType.toUpperCase())
    if (!isAttachment && coverRequired && !isPdfFile(fileRef)) {
      return NextResponse.json({ error: 'QP/WI ต้องใช้ PDF เนื้อหาในช่องไฟล์ทางการ' }, { status: 422 })
    }
    if (!isAttachment && !coverRequired && !isPdfFile(fileRef) && !isSourceFile(fileRef)) {
      return NextResponse.json({ error: 'ไฟล์ทางการรองรับ PDF, DOC, DOCX, XLS, XLSX' }, { status: 422 })
    }
    if (Number.isFinite(fileSize) && fileSize > MAX_OFFICIAL_FILE_SIZE) {
      return NextResponse.json({ error: 'ไฟล์ทางการใหญ่เกิน 50 MB' }, { status: 422 })
    }

    if (isSetRequest) {
      const validation = validateSetUploadFile({
        uploadKind: setItemKind,
        documentType: isAttachment ? null : docType,
        name: fileName,
        key: `${registrationSetStoragePrefix(mainDocumentId)}placeholder/${safeStorageName(fileName)}`,
        mime: resolvedFileType,
      })
      if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: 422 })
    }

    const year = new Date().getFullYear()
    const safeName = safeStorageName(fileName)
    const key = isSetRequest
      ? `${registrationSetStoragePrefix(mainDocumentId)}${year}/${crypto.randomUUID()}-${safeName}`
      : `${isAttachment ? 'documents/attachments/set' : `documents/${docType.toLowerCase().replace(/[^a-z]/g, '') || 'others'}`}/${year}/${Date.now()}-${safeName}`
    const uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({
        Bucket: requiredEnv('R2_BUCKET_NAME'),
        Key: key,
        ContentType: resolvedFileType,
      }),
      { expiresIn: 300 },
    )
    if (isSetRequest) {
      // The signed PUT is used immediately, but a 30-file sequential batch can take
      // considerably longer before the final registration POST reaches the server.
      const expiresAt = new Date(Date.now() + SET_UPLOAD_CLAIM_TTL_MS).toISOString()
      const inserted = await supabaseAdmin
        .from('document_set_uploads')
        .insert({
          document_id: mainDocumentId,
          actor_id: actor.id,
          upload_kind: setItemKind,
          storage_key: key,
          file_name: fileName,
          file_size: fileSize,
          mime_type: resolvedFileType,
          expires_at: expiresAt,
        })
        .select('id')
        .single()
      if (inserted.error) throw inserted.error
      return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, uploadId: inserted.data.id, key, contentType: resolvedFileType })
    }
    return NextResponse.json({ uploadMode: 'direct-r2', uploadUrl, key, contentType: resolvedFileType })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' },
      { status: 500 },
    )
  }
}
