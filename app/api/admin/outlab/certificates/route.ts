import { NextRequest, NextResponse } from 'next/server'
import { externalQualityContext, auditExternalQuality, externalQualityError } from '@/lib/external-quality/access'
import { certificateSchema } from '@/lib/outlab/schemas'
import { certificatePayload } from '@/lib/outlab/api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const ctx = await externalQualityContext('outlab', true); if (ctx.response) return ctx.response
  try {
    const input = certificateSchema.parse(await req.json())
    if (input.supersedesId) {
      const { data: previous, error: previousError } = await supabaseAdmin.from('outlab_certificates').select('id').eq('id', input.supersedesId).eq('laboratory_id', input.laboratoryId).eq('lifecycle', 'current').maybeSingle()
      if (previousError) throw previousError
      if (!previous) return NextResponse.json({ error: 'ไม่พบใบรับรองปัจจุบันที่ต้องการต่ออายุในห้องปฏิบัติการนี้' }, { status: 422 })
    }
    const { data, error } = await supabaseAdmin.from('outlab_certificates').insert({ ...certificatePayload(input, ctx.actor!.id), created_by: ctx.actor!.id }).select('*').single()
    if (error) throw error
    if (input.supersedesId && input.lifecycle === 'current') {
      const { error: oldError } = await supabaseAdmin.from('outlab_certificates').update({ lifecycle: 'superseded', updated_at: new Date().toISOString(), updated_by: ctx.actor!.id }).eq('id', input.supersedesId).eq('laboratory_id', input.laboratoryId)
      if (oldError) {
        await supabaseAdmin.from('outlab_certificates').delete().eq('id', data.id)
        throw oldError
      }
    }
    await auditExternalQuality('outlab', 'certificate.create', ctx.actor!.id, data.id, `${data.standard_name} · ${data.expires_on}`)
    return NextResponse.json(data, { status: 201 })
  } catch (error) { return externalQualityError(error) }
}
