import { NextRequest, NextResponse } from 'next/server'
import { requireHeadContactAccess } from '@/lib/head-contact/guard'
import { HEAD_CONTACT_CATEGORIES, HEAD_CONTACT_STATUSES } from '@/lib/head-contact/constants'
import { getHeadContactSummary, listHeadContactSubmissions } from '@/lib/head-contact/admin-server'
import type { HeadContactCategory, HeadContactStatus } from '@/lib/head-contact/constants'

export async function GET(request: NextRequest) {
  const guard = await requireHeadContactAccess()
  if ('error' in guard) return guard.error
  const params = request.nextUrl.searchParams
  const status = params.get('status')
  const category = params.get('category')
  const options = {
    page: Number(params.get('page') ?? 1),
    pageSize: Number(params.get('pageSize') ?? 50),
    search: params.get('search') ?? undefined,
    status: HEAD_CONTACT_STATUSES.includes(status as HeadContactStatus) ? status as HeadContactStatus : undefined,
    category: HEAD_CONTACT_CATEGORIES.includes(category as HeadContactCategory) ? category as HeadContactCategory : undefined,
    unitId: params.get('unitId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  }
  try {
    const [result, summary] = await Promise.all([listHeadContactSubmissions(options), getHeadContactSummary()])
    return NextResponse.json({ ...result, summary }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'โหลดข้อมูลไม่สำเร็จ' }, { status: 500 })
  }
}
