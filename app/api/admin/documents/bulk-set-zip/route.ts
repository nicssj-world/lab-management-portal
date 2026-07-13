import JSZip from 'jszip'
import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonForbidden, jsonUnauthorized } from '@/lib/auth/guards'
import { contentDispositionForDownload } from '@/lib/documents/download-filename'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { gatherRegistrationSetZipTargets, getObjectBytes, markRegistrationSetDownloaded, uniqueFolder, uniquePath } from '@/lib/documents/registration-set-zip'

export const runtime = 'nodejs'
export const maxDuration = 300

type Payload = { mainIds?: unknown }

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const canDownloadSet = actor.role === 'Admin'
    || actor.role === 'Document Controller'
    || actor.doc_role === 'Document Controller'
  if (!canDownloadSet) return jsonForbidden()

  let payload: Payload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 422 })
  }

  const mainIds = Array.isArray(payload.mainIds)
    ? Array.from(new Set(payload.mainIds.filter((id): id is string => typeof id === 'string' && id.length > 0)))
    : []
  if (mainIds.length === 0) return NextResponse.json({ error: 'กรุณาเลือกอย่างน้อย 1 ชุดเอกสาร' }, { status: 422 })

  const zip = new JSZip()
  const usedFolders = new Set<string>()
  const usedPaths = new Set<string>()
  const skipped: { mainId: string; reason: string }[] = []
  let fileCount = 0

  for (const mainId of mainIds) {
    const result = await gatherRegistrationSetZipTargets(mainId)
    if (!result.ok) {
      skipped.push({ mainId, reason: result.error })
      continue
    }
    const folder = uniqueFolder(result.mainDocumentCode, `set-${mainId}`, usedFolders)
    try {
      const files: { path: string; bytes: Uint8Array }[] = []
      for (const target of result.targets) {
        const bytes = await getObjectBytes(target)
        files.push({ path: `${folder}/${target.name}`, bytes })
      }
      for (const file of files) {
        zip.file(uniquePath(file.path, usedPaths), file.bytes)
        fileCount += 1
      }
    } catch (error) {
      usedFolders.delete(folder)
      skipped.push({ mainId, reason: error instanceof Error ? error.message : 'ไม่สามารถเตรียมไฟล์ ZIP ได้' })
    }
  }

  if (fileCount === 0) {
    return NextResponse.json({ error: 'ไม่มีไฟล์ในชุดที่เลือกให้ดาวน์โหลด', skipped }, { status: 404 })
  }

  if (skipped.length > 0) {
    const notes = ['ชุดเอกสารต่อไปนี้ไม่ถูกรวมใน ZIP:', ...skipped.map((s) => `- ${s.mainId}: ${s.reason}`)].join('\n')
    zip.file('_download-notes.txt', notes)
  }

  let zipped: ArrayBuffer
  try {
    zipped = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (error) {
    console.error('Bulk registration set ZIP generation failed', { mainIds, error })
    return NextResponse.json({ error: 'ไม่สามารถสร้างไฟล์ ZIP ได้' }, { status: 500 })
  }

  const succeededIds = mainIds.filter((id) => !skipped.some((s) => s.mainId === id))
  for (const mainId of succeededIds) {
    supabaseAdmin.from('document_access_logs')
      .insert({ document_id: mainId, user_id: actor.id, action: 'download' })
      .then(undefined, () => {})
    markRegistrationSetDownloaded(mainId, actor.name)
  }

  const zipName = `document-sets-${succeededIds.length}.zip`

  return new NextResponse(zipped, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDispositionForDownload(zipName),
      'Content-Length': String(zipped.byteLength),
      'X-Included-Sets': String(succeededIds.length),
      'X-Skipped-Sets': String(skipped.length),
    },
  })
}
