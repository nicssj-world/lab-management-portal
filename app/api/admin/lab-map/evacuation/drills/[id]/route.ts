import { NextResponse } from 'next/server'
import { requireSafetyEditor } from '@/lib/lab-map/safety-access'
import { updateDrillSessionSchema } from '@/lib/lab-map/evacuation-api'
import { updateDrillSession } from '@/lib/lab-map/evacuation-server'

type Context = { params: Promise<{ id: string }> }

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'บันทึกการซ้อมไม่สำเร็จ'
  const status = /ถูกแก้ไข|ซ้ำ|duplicate/i.test(message) ? 409 : /ไม่พบ|not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}

export async function PATCH(req: Request, { params }: Context) {
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = updateDrillSessionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลการซ้อมไม่ถูกต้อง' }, { status: 422 })
  try { return NextResponse.json({ data: await updateDrillSession((await params).id, parsed.data, guard.actor) }) }
  catch (error) { return errorResponse(error) }
}
