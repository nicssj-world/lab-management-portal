import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { supabaseAdmin } from '@/lib/supabase/admin'
const schema = z.object({ userId: z.string().uuid(), enabled: z.boolean() })
export async function GET() {
  const ctx = await externalQualityContext('outlab'); if (ctx.response) return ctx.response
  const { data, error } = await supabaseAdmin.from('outlab_editors').select('user_id').order('created_at')
  if (error) return externalQualityError(error)
  return NextResponse.json({ userIds: (data ?? []).map(row => row.user_id), isAdmin: ctx.isAdmin })
}
export async function PATCH(req: NextRequest) {
  const ctx = await externalQualityContext('outlab'); if (ctx.response) return ctx.response
  if (!ctx.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const input = schema.parse(await req.json())
    const result = input.enabled
      ? await supabaseAdmin.from('outlab_editors').upsert({ user_id: input.userId, created_by: ctx.actor!.id }, { onConflict: 'user_id' })
      : await supabaseAdmin.from('outlab_editors').delete().eq('user_id', input.userId)
    if (result.error) throw result.error
    await auditExternalQuality('outlab', 'editor.update', ctx.actor!.id, input.userId, input.enabled ? 'grant' : 'revoke')
    return NextResponse.json({ success: true })
  } catch (error) { return externalQualityError(error) }
}
