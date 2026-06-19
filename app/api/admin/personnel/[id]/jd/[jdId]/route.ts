import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireResource } from '@/lib/auth/guards'
import { JdSchema } from '@/lib/validations/personnel'
import { toMsg } from '@/lib/personnel/crud'

// PATCH a JDJS record. If version OR content/file changed, snapshot the old state to staff_jd_revisions first.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ jdId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { jdId } = await ctx.params
  try {
    const parsed = JdSchema.partial().safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' }, { status: 422 })
    }
    const { revision_note, ...fields } = parsed.data

    const { data: current } = await supabaseAdmin.from('staff_jd').select('*').eq('id', jdId).maybeSingle()
    if (!current) return NextResponse.json({ error: 'ไม่พบ JDJS' }, { status: 404 })

    const versionChanged = fields.version != null && fields.version !== current.version
    const contentChanged = fields.content != null && fields.content !== current.content
    const fileChanged = fields.file_url != null && fields.file_url !== current.file_url
    const approverPositionChanged = fields.approver_position != null && fields.approver_position !== current.approver_position
    if (versionChanged || contentChanged || fileChanged || approverPositionChanged) {
      const revisionPayload = {
        jd_id: jdId,
        version: current.version,
        content: current.content,
        file_url: current.file_url,
        effective_date: current.effective_date,
        approver_name: current.approver_name,
        approver_position: current.approver_position,
        revision_note: revision_note ?? null,
        revised_by: actor.id,
      }
      const { error: revisionError } = await supabaseAdmin.from('staff_jd_revisions').insert(revisionPayload)
      if (revisionError && revisionError.message.includes('approver_position')) {
        const { approver_position, ...legacyRevisionPayload } = revisionPayload
        void approver_position
        await supabaseAdmin.from('staff_jd_revisions').insert(legacyRevisionPayload)
      }
    }

    const { data, error } = await supabaseAdmin
      .from('staff_jd')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', jdId)
      .select()
      .single()
    if (error && error.message.includes('approver_position')) {
      const { approver_position, ...legacyFields } = fields
      void approver_position
      const fallback = await supabaseAdmin
        .from('staff_jd')
        .update({ ...legacyFields, updated_at: new Date().toISOString() })
        .eq('id', jdId)
        .select()
        .single()
      if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 })
      return NextResponse.json(fallback.data)
    }
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    supabaseAdmin.from('audit_log').insert({ action: 'personnel.jd.update', user_id: actor.id, target: jdId }).then(undefined, () => {})
    return NextResponse.json(data)
  } catch (err) {
    return NextResponse.json({ error: toMsg(err) }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ jdId: string }> }) {
  const { actor, response } = await requireResource('บุคลากร', 'edit')
  if (!actor) return response
  const { jdId } = await ctx.params
  const { error } = await supabaseAdmin.from('staff_jd').update({ deleted_at: new Date().toISOString() }).eq('id', jdId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
