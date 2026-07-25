import { NextRequest, NextResponse } from 'next/server'
import { requirePersonnelManage } from '@/lib/auth/guards'
import { ExemptionSchema } from '@/lib/personnel/annual-agreements'
import { exemptAgreementRecipient } from '@/lib/personnel/annual-agreements-server'

export async function POST(req: NextRequest, ctx: RouteContext<'/api/admin/personnel/agreements/campaigns/[campaignId]/recipients/[profileId]/exempt'>) {
  const access = await requirePersonnelManage()
  if (access.response) return access.response
  const parsed = ExemptionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ต้องระบุเหตุผล' }, { status: 422 })
  try {
    const { campaignId, profileId } = await ctx.params
    await exemptAgreementRecipient(campaignId, profileId, parsed.data.reason, access.actor.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'ยกเว้นไม่สำเร็จ' }, { status: 422 })
  }
}
