import { NextResponse } from 'next/server'
import { isSafetyEditor, requireSafetyViewer } from '@/lib/lab-map/safety-access'
import { getEvacuationDashboard } from '@/lib/lab-map/evacuation-server'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'ดำเนินการไม่สำเร็จ'
  const status = /ถูกแก้ไข|ซ้ำ|duplicate/i.test(message) ? 409 : /ไม่พบ|not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}

export async function GET() {
  const guard = await requireSafetyViewer()
  if (guard.response) return guard.response
  try {
    const level = (await isSafetyEditor(guard.actor)) ? 'edit' : 'view'
    return NextResponse.json({ data: await getEvacuationDashboard(guard.actor.id, level) })
  } catch (error) {
    return errorResponse(error)
  }
}
