import { NextRequest, NextResponse } from 'next/server'
import { requireResource } from '@/lib/auth/guards'
import {
  MAX_STAFF_FILE_BYTES,
  downloadStaffFile,
  staffFileExtForType,
  staffFileTypeForPath,
  uploadStaffFile,
  createStaffSignedUrl,
} from '@/lib/personnel/storage'
import { toMsg } from '@/lib/personnel/crud'

function safeFileName(path: string): string {
  return (path.split('/').pop() || 'attachment').replace(/["\r\n]/g, '_')
}

// GET a fresh signed URL, or inline preview when ?inline=1.
export async function GET(req: NextRequest) {
  const { actor, response } = await requireResource('บุคลากร', 'view')
  if (!actor) return response
  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'missing path' }, { status: 422 })
  if (req.nextUrl.searchParams.get('inline') === '1') {
    try {
      const file = await downloadStaffFile(path)
      const contentType = file.type && file.type !== 'application/octet-stream'
        ? file.type
        : staffFileTypeForPath(path)
      return new NextResponse(Buffer.from(await file.arrayBuffer()), {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${safeFileName(path)}"`,
          'Cache-Control': 'private, max-age=300',
        },
      })
    } catch (err) {
      return NextResponse.json({ error: toMsg(err) }, { status: 404 })
    }
  }
  return NextResponse.json({ signed_url: await createStaffSignedUrl(path) })
}

// POST a file (cert / license / training evidence). Returns the storage path;
// the client then saves it in the record's file_url / evidence_url field.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { id } = await ctx.params
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })
    }
    const ext = staffFileExtForType(file.type)
    if (!ext) return NextResponse.json({ error: 'รองรับเฉพาะ PDF, PNG, JPG หรือ WebP' }, { status: 415 })
    if (file.size > MAX_STAFF_FILE_BYTES) {
      return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 10 MB' }, { status: 413 })
    }
    const kind = (form.get('kind') as string | null) ?? 'doc'
    const safeKind = kind.replace(/[^a-z0-9_-]/gi, '')
    if (safeKind === 'jdjs' && ext !== 'pdf') {
      return NextResponse.json({ error: 'JDJS รองรับเฉพาะไฟล์ PDF' }, { status: 415 })
    }
    const path = `${id}/${safeKind}/${Date.now()}.${ext}`
    await uploadStaffFile(path, file)
    return NextResponse.json({ file_url: path, signed_url: await createStaffSignedUrl(path) }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}
