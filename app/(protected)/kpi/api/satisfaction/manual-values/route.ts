import { NextResponse, type NextRequest } from 'next/server'
import { canAccessResource, getActor } from '@/lib/auth/guards'
import { satisfactionApiError, satisfactionRepositoryErrorResponse } from '@/lib/kpi/satisfaction-http'
import { auditSatisfactionChange, saveManualSatisfactionValue } from '@/lib/kpi/satisfaction-repository'
import { validateManualSatisfactionValue } from '@/lib/kpi/satisfaction-validation'

export async function POST(request: NextRequest) {
  const actor = await getActor()
  if (!actor) return satisfactionApiError('unauthorized', 'กรุณาเข้าสู่ระบบก่อนบันทึกข้อมูล KPI', 401)
  if (!(await canAccessResource(actor, 'KPI', 'edit'))) {
    return satisfactionApiError('forbidden', 'ไม่มีสิทธิ์แก้ไขข้อมูล KPI', 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return satisfactionApiError('malformed_json', 'รูปแบบ JSON ไม่ถูกต้อง', 400)
  }
  const validation = validateManualSatisfactionValue(body)
  if (!validation.ok) return satisfactionApiError('invalid_manual_value', validation.error, 422)

  try {
    const value = await saveManualSatisfactionValue(validation.data)
    await auditSatisfactionChange({
      action: 'kpi.satisfaction.manual.upsert',
      actorId: actor.id,
      target: `${value.metricCode}/${value.fiscalYear}`,
      detail: {
        metricCode: value.metricCode,
        fiscalYear: value.fiscalYear,
        value: value.value,
        source: 'manual',
        sourceNote: value.sourceNote,
      },
    })
    return NextResponse.json({ value })
  } catch (error) {
    return satisfactionRepositoryErrorResponse(error)
  }
}
