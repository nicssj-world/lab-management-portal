import { NextResponse } from 'next/server'
import { requireSafetyEditor, requireSafetyManager } from '@/lib/lab-map/safety-access'
import { evacuationPlanTransitionSchema, updateEvacuationPlanSchema } from '@/lib/lab-map/evacuation-api'
import { transitionEvacuationPlan, updateEvacuationPlan } from '@/lib/lab-map/evacuation-server'

type Context = { params: Promise<{ id: string }> }

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'บันทึกแผนไม่สำเร็จ'
  const status = /ถูกแก้ไข|ซ้ำ|duplicate/i.test(message) ? 409 : /ไม่พบ|not found/i.test(message) ? 404 : /Forbidden/i.test(message) ? 403 : 422
  return NextResponse.json({ error: message }, { status })
}

export async function PATCH(req: Request, { params }: Context) {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const id = (await params).id
  const actionParsed = evacuationPlanTransitionSchema.safeParse(body)
  if (actionParsed.success) {
    const guard = actionParsed.data.action === 'submit' ? await requireSafetyEditor() : await requireSafetyManager()
    if (guard.response) return guard.response
    try { return NextResponse.json({ data: await transitionEvacuationPlan(id, actionParsed.data.action, guard.actor) }) }
    catch (error) { return errorResponse(error) }
  }
  const guard = await requireSafetyEditor()
  if (guard.response) return guard.response
  const parsed = updateEvacuationPlanSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'ข้อมูลแผนไม่ถูกต้อง' }, { status: 422 })
  try { return NextResponse.json({ data: await updateEvacuationPlan(id, parsed.data, guard.actor) }) }
  catch (error) { return errorResponse(error) }
}
