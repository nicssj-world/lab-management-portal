import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { extractDocxHeaderMetadata } from '@/lib/documents/docx-header'
import { extractXlsxHeaderMetadata } from '@/lib/documents/xlsx-header'

const EXTRACT_MAX_BYTES = 20 * 1024 * 1024

function fileTooLargeResponse() {
  return NextResponse.json(
    { error: 'ดึงข้อมูลจากไฟล์รองรับไฟล์ไม่เกิน 20 MB กรุณาลดขนาดไฟล์หรือกรอกข้อมูลเอง' },
    { status: 413 },
  )
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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

  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  const buffer = Buffer.from(await file.arrayBuffer())
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
