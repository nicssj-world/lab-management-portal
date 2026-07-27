import { NextResponse, type NextRequest } from 'next/server'
import { parseJson, transitionError, unexpectedError } from '@/lib/chemical-safety/api'
import { chemicalSdsDraftPatchSchema } from '@/lib/chemical-safety/schemas'
import {
  claimOrphanDraft,
  resolveSdsForCustodian,
  toSdsRpcHazards,
  toSdsRpcMetadata,
} from '@/lib/chemical-safety/sds-workflow'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/sds/[id]'>,
) {
  const { id } = await ctx.params
  const input = await parseJson(request, chemicalSdsDraftPatchSchema)
  if (input.response) return input.response

  try {
    const resolved = await resolveSdsForCustodian(id)
    if (resolved.response) return resolved.response
    if (resolved.context.status !== 'draft') {
      return NextResponse.json({ error: 'แก้ไขได้เฉพาะฉบับร่าง' }, { status: 409 })
    }

    // ฉบับร่างที่นำเข้ามาไม่มีเจ้าของ ต้องรับเป็นเจ้าของก่อน ไม่งั้น RPC จะปฏิเสธ
    await claimOrphanDraft(resolved.context, resolved.actor.id)

    const { updatedAt, fileId, ...metadata } = input.data
    const { error } = await supabaseAdmin.rpc('update_chemical_sds_draft', {
      p_version_id: id,
      p_actor_id: resolved.actor.id,
      p_expected_updated_at: updatedAt,
      p_metadata: toSdsRpcMetadata(metadata, fileId ?? null),
      p_hazards: toSdsRpcHazards(metadata),
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (error) {
    return transitionError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: RouteContext<'/api/admin/chemical-safety/sds/[id]'>,
) {
  const { id } = await ctx.params
  try {
    const resolved = await resolveSdsForCustodian(id)
    if (resolved.response) return resolved.response
    // ลบได้เฉพาะฉบับร่าง — ฉบับที่ผ่านการทบทวนแล้วเป็นบันทึกคุณภาพ ต้องคงไว้
    if (resolved.context.status !== 'draft') {
      return NextResponse.json({ error: 'ลบได้เฉพาะฉบับร่าง' }, { status: 409 })
    }

    const { error } = await supabaseAdmin
      .from('chemical_sds_versions')
      .delete()
      .eq('id', id)
      .eq('status', 'draft')
    if (error) throw error

    supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.sds.delete_draft',
      user_id: resolved.actor.id,
      target: id,
      detail: JSON.stringify({ productId: resolved.context.productId }),
    }).then(undefined, () => {})

    return NextResponse.json({ ok: true })
  } catch (error) {
    return unexpectedError(error)
  }
}
