import { NextRequest, NextResponse } from 'next/server'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { DisclosureSchema } from '@/lib/personnel/annual-agreements'
import { submitAgreementTask } from '@/lib/personnel/annual-agreements-server'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/me/annual-agreements/[campaignId]/submit'>) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { campaignId } = await ctx.params
  const form = await req.formData()
  const signingMethod = form.get('signingMethod')
  const rawDisclosure = form.get('disclosure')
  if (signingMethod !== 'drawn' && signingMethod !== 'saved') return NextResponse.json({ error: 'วิธีลงนามไม่ถูกต้อง' }, { status: 422 })
  let disclosure
  try { disclosure = DisclosureSchema.parse(JSON.parse(typeof rawDisclosure === 'string' ? rawDisclosure : '{}')) }
  catch { return NextResponse.json({ error: 'ข้อมูลการเปิดเผยกิจกรรมไม่ถูกต้อง' }, { status: 422 }) }
  try {
    const result = await submitAgreementTask({
      campaignId, profileId: actor.id, signingMethod,
      drawnFile: form.get('signature') instanceof File ? form.get('signature') as File : null,
      disclosure,
    })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ลงนามไม่สำเร็จ' }, { status: 422 })
  }
}
