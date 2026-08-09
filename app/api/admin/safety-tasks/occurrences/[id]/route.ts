import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { removeOccurrence, updateOccurrence } from '@/lib/quality-tasks/server'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), plannedDate: z.string().date().nullable(), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('submit'), completionNote: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('approve'), note: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('reject'), reason: z.string().trim().min(1).max(2000) }),
  z.object({ action: z.literal('complete'), completionNote: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('reopen'), reason: z.string().trim().min(1).max(500) }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const instance = await updateOccurrence((await params).id, actionSchema.parse(await req.json()), ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ instance })
  } catch (error) { return safetyTaskError(error) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const body = await req.json().catch(() => ({})) as { reason?: unknown }
    const result = await removeOccurrence((await params).id, typeof body.reason === 'string' ? body.reason : null, ctx.actor, ctx.level, 'safety')
    return NextResponse.json({ ok: true, ...result })
  } catch (error) { return safetyTaskError(error) }
}
