import { NextResponse } from 'next/server'
import { createEvacuationPlan } from '@/lib/lab-map/evacuation-server'
import { createEvacuationPlanSchema } from '@/lib/lab-map/evacuation-api'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'บันทึกแผนไม่สำเร็จ'
  const status = /ซ้ำ|duplicate/i.test(message) ? 409 : /ไม่พบ|not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = createEvacuationPlanSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลแผนไม่ถูกต้อง' }, { status: 422 })
  try {
    return NextResponse.json({ data: await createEvacuationPlan(parsed.data, guard.actor) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
