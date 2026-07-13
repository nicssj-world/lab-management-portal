import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { contentDispositionForDownload } from '@/lib/documents/download-filename'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { gatherRegistrationSetZipTargets, getObjectBytes, markRegistrationSetDownloaded, safePathPart, uniquePath } from '@/lib/documents/registration-set-zip'

export const runtime = 'nodejs'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const canDownloadSet = actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
  if (!canDownloadSet) return jsonForbidden()

  const { id } = await params
  const result = await gatherRegistrationSetZipTargets(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  const zip = new JSZip()
  const usedPaths = new Set<string>()
  try {
    for (const target of result.targets) {
      const bytes = await getObjectBytes(target)
      const path = uniquePath(`${target.folder}/${target.name}`, usedPaths)
      zip.file(path, bytes)
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ไม่สามารถเตรียมไฟล์ ZIP ได้' },
      { status: 502 },
    )
  }

  let zipped: ArrayBuffer
  try {
    zipped = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (error) {
    console.error('Registration set ZIP generation failed', { mainDocumentId: id, error })
    return NextResponse.json({ error: 'ไม่สามารถสร้างไฟล์ ZIP ได้' }, { status: 500 })
  }

  const zipName = `${safePathPart(result.mainDocumentCode, 'document')}-set.zip`
  supabaseAdmin.from('document_access_logs')
    .insert({ document_id: id, user_id: actor.id, action: 'download' })
    .then(undefined, () => {})
  markRegistrationSetDownloaded(id, actor.name)

  return new NextResponse(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDispositionForDownload(zipName),
      'Content-Length': String(zipped.byteLength),
    },
  })
}
