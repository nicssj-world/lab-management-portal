import { NextResponse } from 'next/server'
import { requireSatisfaction } from '@/lib/surveys/guard'
import { getSurveyDashboardData } from '@/lib/surveys/dashboard-server'

export async function GET(request: Request) {
  const access = await requireSatisfaction('view')
  if (access.response) return access.response
  const query = new URL(request.url).searchParams
  const campaignId = query.get('campaignId')
  if (!campaignId) return NextResponse.json({ error: 'กรุณาเลือกรอบเก็บข้อมูล' }, { status: 400 })
  try {
    return NextResponse.json(await getSurveyDashboardData({
      campaignId,
      from: query.get('from'),
      to: query.get('to'),
      grouping: query.get('grouping') === 'month' ? 'month' : 'day',
    }))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'โหลดผลสำรวจไม่สำเร็จ' }, { status: 404 })
  }
}
