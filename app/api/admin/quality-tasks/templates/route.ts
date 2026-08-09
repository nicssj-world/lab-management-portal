import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { getQualityTaskTemplates, saveTemplate } from '@/lib/quality-tasks/server'
import { DEPARTMENTS } from '@/lib/validations/user-schema'

export const scheduleSchema = z.object({ id: z.string().optional().default(''), templateId: z.string().optional().default(''), intervalUnit: z.enum(['day','week','month','year']), intervalCount: z.number().int().positive(), recurrenceMode: z.enum(['fixed_calendar','rolling_completion']).default('fixed_calendar'), startsOn: z.string().date(), endsOn: z.string().date().nullable(), active: z.boolean().default(true) })
export const assigneeEntrySchema = z.object({ userId: z.string().uuid().nullable(), manualName: z.string().trim().max(120).nullable() }).refine(e => Boolean(e.userId) || Boolean(e.manualName?.trim()), { message: 'ต้องเลือกผู้ใช้หรือกรอกชื่อผู้รับผิดชอบ' })
export const evidenceRequirementSchema = z.object({ id: z.string().optional().default(''), templateId: z.string().optional().default(''), label: z.string().trim().min(1).max(160), evidenceKind: z.string().trim().min(1).max(60), required: z.boolean().default(true), minimumFiles: z.number().int().min(1).max(20).default(1), sortOrder: z.number().int().min(1).default(1) })
export const templateSchema = z.object({ workstream: z.literal('quality').default('quality'), categoryCode: z.string().regex(/^[A-I]$/), categoryName: z.string().trim().min(1), activityNo: z.number().int().positive().nullable(), title: z.string().trim().min(1), description: z.string().nullable(), referenceCode: z.string().nullable(), frequencyText: z.string().trim().min(1), ownerText: z.string(), taskKind: z.enum(['activity','meeting']), approvalMode: z.literal('none').default('none'), integrationKind: z.literal('none').default('none'), approverId: z.null().default(null), reminderDays: z.number().int().min(0).max(365), evidenceRequired: z.boolean(), active: z.boolean(), defaultAssignees: z.array(assigneeEntrySchema), defaultParticipantDepts: z.array(z.enum(DEPARTMENTS)).default([]), defaultParticipantUserIds: z.array(z.string().uuid()).default([]), evidenceRequirements: z.array(evidenceRequirementSchema).default([]), schedules: z.array(scheduleSchema) })

export async function GET() {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ templates: await getQualityTaskTemplates() }) } catch (error) { return qualityTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('edit'); if (ctx.response) return ctx.response
  try { const id = await saveTemplate(templateSchema.parse(await req.json()), ctx.actor); return NextResponse.json({ id }, { status: 201 }) } catch (error) { return qualityTaskError(error) }
}

