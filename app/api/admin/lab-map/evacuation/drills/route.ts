import { NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { createDrillSchema } from '@/lib/lab-map/evacuation-api'
import { createDrillCycle, createDrillSession } from '@/lib/lab-map/evacuation-server'

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'บันทึกการซ้อมไม่สำเร็จ'
  const status = /ถูกแก้ไข|ซ้ำ|duplicate/i.test(message) ? 409 : /ไม่พบ|not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}

export async function POST(req: Request) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = createDrillSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลการซ้อมไม่ถูกต้อง' }, { status: 422 })
  try {
    if (parsed.data.kind === 'cycle') return NextResponse.json({ data: await createDrillCycle(parsed.data, guard.actor) }, { status: 201 })
    return NextResponse.json({ data: await createDrillSession(parsed.data, guard.actor) }, { status: 201 })
  } catch (error) {
    return errorResponse(error)
  }
}
