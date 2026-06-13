import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import {
  MAX_STAFF_FILE_BYTES, staffFileExtForType, uploadStaffFile, createStaffSignedUrl, removeStaffFile,
} from '@/lib/personnel/storage'
import { toMsg } from '@/lib/personnel/crud'

// POST upload/replace a node photo
export async function POST(req: NextRequest, ctx: { params: Promise<{ nodeId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { nodeId } = await ctx.params
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: 'ไม่พบไฟล์' }, { status: 422 })
    const ext = staffFileExtForType(file.type)
    if (!ext || ext === 'pdf') return NextResponse.json({ error: 'รองรับเฉพาะรูปภาพ PNG, JPG, WebP' }, { status: 415 })
    if (file.size > MAX_STAFF_FILE_BYTES) return NextResponse.json({ error: 'ไฟล์ต้องไม่เกิน 10 MB' }, { status: 413 })

    const { data: node } = await supabaseAdmin.from('org_chart_nodes').select('photo_url').eq('id', nodeId).maybeSingle()
    const path = `org/${nodeId}/${Date.now()}.${ext}`
    await uploadStaffFile(path, file)
    await supabaseAdmin.from('org_chart_nodes').update({ photo_url: path, updated_at: new Date().toISOString() }).eq('id', nodeId)
    if (node?.photo_url && node.photo_url !== path) await removeStaffFile(node.photo_url)

    return NextResponse.json({ photo_url: path, photo: await createStaffSignedUrl(path) }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

// DELETE remove the photo
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ nodeId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { nodeId } = await ctx.params
  const { data: node } = await supabaseAdmin.from('org_chart_nodes').select('photo_url').eq('id', nodeId).maybeSingle()
  if (node?.photo_url) await removeStaffFile(node.photo_url)
  await supabaseAdmin.from('org_chart_nodes').update({ photo_url: null, updated_at: new Date().toISOString() }).eq('id', nodeId)
  return NextResponse.json({ ok: true })
}
