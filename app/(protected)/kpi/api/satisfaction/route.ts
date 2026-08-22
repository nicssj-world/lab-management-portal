import { NextResponse, type NextRequest } from 'next/server'
import { canAccessResource, getActor } from '@/lib/auth/guards'
import { buildSatisfactionDashboard, getThaiFiscalYear } from '@/lib/kpi/satisfaction-dashboard'
import { satisfactionApiError, satisfactionRepositoryErrorResponse } from '@/lib/kpi/satisfaction-http'
import { loadSatisfactionDashboardRecords } from '@/lib/kpi/satisfaction-repository'
import { validateSatisfactionDashboardQuery } from '@/lib/kpi/satisfaction-validation'
import { getPermissionsWithSatisfactionOverride } from '@/lib/permissions'
import { SATISFACTION_RESOURCE } from '@/lib/surveys/guard'

export async function GET(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return satisfactionApiError('unauthorized', 'กรุณาเข้าสู่ระบบก่อนดูข้อมูล KPI', 401)
  if (!(await canAccessResource(actor, 'KPI', 'view'))) {
    return satisfactionApiError('forbidden', 'ไม่มีสิทธิ์ดูข้อมูล KPI', 403)
  }

  const params = request.nextUrl.searchParams
  const validation = validateSatisfactionDashboardQuery({
    fiscalYear: params.get('fiscalYear') ?? undefined,
    metricCode: params.get('metricCode') ?? undefined,
    source: params.get('source') ?? undefined,
    status: params.get('status') ?? undefined,
  })
  if (!validation.ok) return satisfactionApiError('invalid_query', validation.error, 400)

  const fiscalYear = validation.data.fiscalYear ?? getThaiFiscalYear()
  try {
    const records = await loadSatisfactionDashboardRecords()
    const data = buildSatisfactionDashboard({
      ...records,
      fiscalYear,
      filters: {
        metricCode: validation.data.metricCode,
        source: validation.data.source,
        status: validation.data.status,
      },
    })
    const satisfactionPermissions = await getPermissionsWithSatisfactionOverride(actor.role, actor.id)
    return NextResponse.json({
      ...data,
      permissions: { canViewCampaign: (satisfactionPermissions[SATISFACTION_RESOURCE] ?? 'none') !== 'none' },
    }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (error) {
    return satisfactionRepositoryErrorResponse(error)
  }
}

// Retired: this endpoint could overwrite survey-origin values and per-year targets.
// Manual writes must use /manual-values, which enforces campaign/publication locks.
export async function POST(_request: NextRequest) {
  const actor = await getActor()
  if (!actor) return satisfactionApiError('unauthorized', 'กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูล KPI', 401)
  return NextResponse.json(
    {
      error: 'ยกเลิกการบันทึกผ่าน endpoint นี้แล้ว กรุณาใช้ /kpi/api/satisfaction/manual-values',
      code: 'legacy_write_retired',
    },
    { status: 405, headers: { Allow: 'GET' } },
  )
}
