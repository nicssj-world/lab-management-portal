import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { removeOccurrence, updateOccurrence } from '@/lib/quality-tasks/server'
import { MEETING_SUMMARY_MAX_HTML_LENGTH } from '@/lib/html-sanitize'
import { DEPARTMENTS } from '@/lib/validations/user-schema'
import { assigneeEntrySchema } from '../../templates/route'

const timeSchema = z.string().trim().regex(/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/, 'รูปแบบเวลาไม่ถูกต้อง').nullable().optional()
const completionNoteSchema = z.string().max(MEETING_SUMMARY_MAX_HTML_LENGTH).nullable()

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('schedule'), plannedDate: z.string().date().nullable(), note: z.string().max(2000).nullable().optional(), startTime: timeSchema, endTime: timeSchema, location: z.string().trim().max(240).nullable().optional(), assignees: z.array(assigneeEntrySchema).optional(), participantDepts: z.array(z.enum(DEPARTMENTS)).optional(), participantUserIds: z.array(z.string().uuid()).optional() }),
  z.object({ action: z.literal('save_completion_note'), completionNote: completionNoteSchema }),
  z.object({ action: z.literal('complete'), completionNote: completionNoteSchema.optional() }),
  z.object({ action: z.literal('reopen'), reason: z.string().trim().min(1).max(500) }),
])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { const instance = await updateOccurrence((await params).id, actionSchema.parse(await req.json()), ctx.actor, ctx.level); return NextResponse.json({ instance }) } catch (error) { return qualityTaskError(error) }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await qualityTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const body = await req.json().catch(() => ({})) as { reason?: unknown }
    const result = await removeOccurrence((await params).id, typeof body.reason === 'string' ? body.reason : null, ctx.actor, ctx.level)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) { return qualityTaskError(error) }
}

