import { NextResponse } from 'next/server'
import { requireAgreementCampaignView } from '@/lib/auth/guards'
import { createAgreementSignedUrl, refreshAgreementEvidence } from '@/lib/personnel/annual-agreements-server'

export async function GET(_req: Request, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]/evidence/[profileId]'>) {
  const access = await requireAgreementCampaignView()
  if (access.response) return access.response
  const { campaignId, profileId } = await ctx.params
  try {
    const path = await refreshAgreementEvidence(campaignId, profileId)
    const url = await createAgreementSignedUrl(path)
    if (!url) return NextResponse.json({ error: 'ไม่สามารถเปิดหลักฐานได้' }, { status: 404 })
    return NextResponse.redirect(url)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ไม่พบหลักฐาน' }, { status: 404 })
  }
}
