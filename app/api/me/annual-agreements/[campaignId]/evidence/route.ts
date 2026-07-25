import { NextResponse } from 'next/server'
import { getActor, jsonUnauthorized } from '@/lib/auth/guards'
import { createAgreementSignedUrl, refreshAgreementEvidence } from '@/lib/personnel/annual-agreements-server'

export async function GET(_req: Request, ctx: RouteContext<'/api/me/annual-agreements/[campaignId]/evidence'>) {
  const actor = await getActor()
  if (!actor) return jsonUnauthorized()
  const { campaignId } = await ctx.params
  try {
    const path = await refreshAgreementEvidence(campaignId, actor.id)
    const url = await createAgreementSignedUrl(path)
    if (!url) return NextResponse.json({ error: 'ไม่สามารถเปิดหลักฐานได้' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่พบหลักฐาน' }, { status: 404 })
  }
}
