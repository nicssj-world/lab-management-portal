import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { updateOccurrence } from '@/lib/quality-tasks/server'

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), plannedDate: z.string().date().nullable(), note: z.string().max(2000).nullable().optional(), assigneeIds: z.array(z.string().uuid()).optional() }),
  z.object({ action: z.literal('complete'), completionNote: z.string().max(2000).nullable().optional() }),
  z.object({ action: z.literal('reopen'), reason: z.string().trim().min(1).max(500) }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { const instance = await updateOccurrence((await params).id, actionSchema.parse(await req.json()), ctx.actor, ctx.level); return NextResponse.json({ instance }) } catch (error) { return qualityTaskError(error) }
}

