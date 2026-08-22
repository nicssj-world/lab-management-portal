import { NextResponse, type NextRequest } from 'next/server'
import { canAccessResource, getActor } from '@/lib/auth/guards'
import { satisfactionApiError, satisfactionRepositoryErrorResponse } from '@/lib/kpi/satisfaction-http'
import {
  auditSatisfactionChange,
  createSatisfactionMetric,
  listSatisfactionMetricCatalog,
  updateSatisfactionMetric,
} from '@/lib/kpi/satisfaction-repository'
import { validateSatisfactionMetricCreate, validateSatisfactionMetricPatch } from '@/lib/kpi/satisfaction-validation'
import { getPermissionsWithSatisfactionOverride } from '@/lib/permissions'
import { SATISFACTION_RESOURCE } from '@/lib/surveys/guard'

async function requireKpiEditor() {
  const actor = await getActor()
  if (!actor) return { response: satisfactionApiError('unauthorized', 'กรุณาเข้าสู่ระบบก่อนแก้ไขข้อมูล KPI', 401) }
  if (!(await canAccessResource(actor, 'KPI', 'edit'))) {
    return { response: satisfactionApiError('forbidden', 'ไม่มีสิทธิ์แก้ไขข้อมูล KPI', 403) }
  }
  return { actor }
}

async function readJson(request: NextRequest): Promise<{ ok: true; value: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, value: await request.json() }
  } catch {
    return { ok: false, response: satisfactionApiError('malformed_json', 'รูปแบบ JSON ไม่ถูกต้อง', 400) }
  }
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return satisfactionApiError('unauthorized', 'กรุณาเข้าสู่ระบบก่อนดูชุดตัวชี้วัด', 401)
  const [canViewKpi, satisfactionPermissions] = await Promise.all([
    canAccessResource(actor, 'KPI', 'view'),
    getPermissionsWithSatisfactionOverride(actor.role, actor.id),
  ])
  if (!canViewKpi && (satisfactionPermissions[SATISFACTION_RESOURCE] ?? 'none') === 'none') {
    return satisfactionApiError('forbidden', 'ไม่มีสิทธิ์ดูชุดตัวชี้วัดความพึงพอใจ', 403)
  }
  try {
    return NextResponse.json(
      { metrics: await listSatisfactionMetricCatalog() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  } catch (error) {
    return satisfactionRepositoryErrorResponse(error)
  }
}

export async function POST(request: NextRequest) {
  const access = await requireKpiEditor()
  if (access.response) return access.response
  const json = await readJson(request)
  if (!json.ok) return json.response
  const validation = validateSatisfactionMetricCreate(json.value)
  if (!validation.ok) return satisfactionApiError('invalid_metric', validation.error, 422)

  try {
    const metric = await createSatisfactionMetric(validation.data)
    await auditSatisfactionChange({
      action: 'kpi.satisfaction.metric.create',
      actorId: access.actor.id,
      target: metric.code,
      detail: { name: metric.name, target: metric.target },
    })
    return NextResponse.json({ metric }, { status: 201 })
  } catch (error) {
    return satisfactionRepositoryErrorResponse(error)
  }
}

export async function PATCH(request: NextRequest) {
  const access = await requireKpiEditor()
  if (access.response) return access.response
  const json = await readJson(request)
  if (!json.ok) return json.response
  const validation = validateSatisfactionMetricPatch(json.value)
  if (!validation.ok) return satisfactionApiError('invalid_metric_patch', validation.error, 422)

  try {
    const metric = await updateSatisfactionMetric(validation.data)
    await auditSatisfactionChange({
      action: 'kpi.satisfaction.metric.update',
      actorId: access.actor.id,
      target: metric.code,
      detail: {
        ...(validation.data.name !== undefined ? { name: validation.data.name } : {}),
        ...(validation.data.target !== undefined ? { target: validation.data.target, targetAppliesToAllYears: true } : {}),
        ...(validation.data.isActive !== undefined ? { isActive: validation.data.isActive } : {}),
      },
    })
    return NextResponse.json({ metric })
  } catch (error) {
    return satisfactionRepositoryErrorResponse(error)
  }
}
