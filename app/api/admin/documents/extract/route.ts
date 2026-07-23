import { NextRequest, NextResponse } from 'next/server'
import { GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { r2, R2_BUCKET } from '@/lib/r2/client'
import { extractDocxHeaderMetadata } from '@/lib/documents/docx-header'
import { extractXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'
import { getActor, canAccessDocuments } from '@/lib/auth/guards'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { privateRequestKey } from '@/lib/security/request-protection'

const EXTRACT_MAX_BYTES = 20 * 1024 * 1024

function fileTooLargeResponse() {
  return NextResponse.json(
    { error: 'ดึงข้อมูลจากไฟล์รองรับไฟล์ไม่เกิน 20 MB กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' },
    { status: 413 },
  )
}

async function getObjectBuffer(key: string) {
  const object = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const body = object.Body
  if (!body) throw new Error('ไม่พบไฟล์ที่อัปโหลดใน R2')
  if ('transformToByteArray' in body && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await body.transformToByteArray())
  }
  const chunks: Uint8Array[] = []
  for await (const chunk of body as AsyncIterable<Uint8Array | Buffer>) {
    chunks.push(chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk))
  }
  return Buffer.concat(chunks)
}

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDocuments(actor, 'edit'))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const extractLimit = consumeRateLimit({
    key: `document-extract:${privateRequestKey('document-extract-actor', actor.id)}`,
    limit: 40,
    windowMs: 10 * 60 * 1000,
  })
  if (!extractLimit.allowed) {
    return NextResponse.json(
      { error: 'มีคำขออ่านไฟล์มากเกินไป กรุณารอสักครู่แล้วลองใหม่' },
      { status: 429, headers: { 'Retry-After': String(extractLimit.retryAfterSeconds) } },
    )
  }

  const contentType = req.headers.get('content-type') ?? ''
  let buffer: Buffer
  let fileName: string

  if (contentType.includes('application/json')) {
    // File was already uploaded directly to R2 via presigned URL — fetch it server-side.
    // This path has no Vercel request-body size limit, so it can use the app's own 20 MB cap.
    const body = await req.json() as { file_key?: string; file_name?: string }
    const fileKey = (body.file_key ?? '').trim()
    fileName = (body.file_name ?? '').trim()
    if (!fileKey || !fileName) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })
    if (!fileKey.startsWith('documents/') || fileKey.includes('..') || fileKey.length > 1_024) {
      return NextResponse.json({ error: 'ไม่อนุญาตให้อ่านไฟล์จากตำแหน่งนี้' }, { status: 403 })
    }

    const size = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: fileKey }))
      .then((o) => o.ContentLength ?? 0)
      .catch(() => null)
    if (size === null) return NextResponse.json({ error: 'ไม่พบไฟล์ที่อัปโหลดใน storage' }, { status: 422 })
    if (size > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    buffer = await getObjectBuffer(fileKey)
  } else {
    const contentLength = Number(req.headers.get('content-length') ?? 0)
    if (contentLength > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    let form: FormData
    try {
      form = await req.formData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const status = /large|size|body|payload/i.test(msg) ? 413 : 400
      return NextResponse.json(
        { error: status === 413 ? 'ไฟล์ใหญ่เกินขนาดที่ระบบอ่านอัตโนมัติได้ กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' : `ไม่สามารถอ่านข้อมูลไฟล์ได้: ${msg}` },
        { status },
      )
    }

    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })
    if (file.size > EXTRACT_MAX_BYTES) return fileTooLargeResponse()

    fileName = file.name
    buffer = Buffer.from(await file.arrayBuffer())
  }

  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  let text = ''

  try {
    if (ext === 'pdf') {
      const { getDocumentProxy, extractText } = await import('unpdf')
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text: pages } = await extractText(pdf, { mergePages: false })
      text = Array.isArray(pages) ? (pages[0] ?? '') : String(pages)
    } else if (ext === 'docx') {
      const mammoth = await import('mammoth')
      const result = await mammoth.extractRawText({ buffer })
      const header = await extractDocxHeaderMetadata(buffer)
      text = [header.text, result.value].filter(Boolean).join('\n\n')
    } else if (ext === 'xlsx') {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as string[][]
      const header = await extractXlsxHeaderMetadata(buffer)
      text = [header.text, rows.flat().filter(Boolean).join('\n')].filter(Boolean).join('\n\n')
    } else {
      return NextResponse.json({ error: 'ไม่รองรับไฟล์ประเภทนี้' }, { status: 422 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `ไม่สามารถอ่านไฟล์ได้: ${msg}` }, { status: 500 })
  }

  return NextResponse.json({ text })
}
