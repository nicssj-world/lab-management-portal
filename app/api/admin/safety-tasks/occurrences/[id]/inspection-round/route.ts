import { NextResponse } from 'next/server'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { openSafetyInspectionRoundFromTask } from '@/lib/quality-tasks/safety-server'

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const result = await openSafetyInspectionRoundFromTask((await params).id, ctx.actor, ctx.level)
    return NextResponse.json(result, { status: result.reused ? 200 : 201 })
  } catch (error) { return safetyTaskError(error) }
}
