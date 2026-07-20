import { NextResponse } from 'next/server'
import { requireSatisfaction } from '@/lib/surveys/guard'
import { createCampaign } from '@/lib/surveys/campaign-server'
import { createCampaignSchema } from '@/lib/surveys/schemas'
import { listCampaigns } from '@/lib/surveys/server'

export async function GET() {
  const access = await requireSatisfaction('edit')
  if (access.response) return access.response
  return NextResponse.json({ campaigns: await listCampaigns() })
}

export async function POST(request: Request) {
  const access = await requireSatisfaction('edit')
  if (access.response) return access.response
  const parsed = createCampaignSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'ข้อมูลรอบเก็บไม่ถูกต้อง', issues: parsed.error.flatten() }, { status: 400 })
  try {
    const created = await createCampaign({ ...parsed.data, actorId: access.actor.id })
    return NextResponse.json(created, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'สร้างรอบไม่สำเร็จ' }, { status: 409 })
  }
}
