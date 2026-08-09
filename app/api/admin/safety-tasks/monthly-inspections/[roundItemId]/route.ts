import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getMonthlySafetyForm, updateMonthlySafetyPointWorkflow } from '@/lib/quality-tasks/monthly-safety-server'

const workflowSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('skip'), reason: z.string().trim().min(1).max(1000) }),
  z.object({
    action: z.literal('reassign'),
    assignments: z.array(z.object({
      userId: z.string().uuid(),
      assignmentRole: z.enum(['primary', 'backup']),
    })).min(1).max(20),
  }),
])

export async function GET(_req: NextRequest, { params }: { params: Promise<{ roundItemId: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { roundItemId } = await params
    return NextResponse.json(await getMonthlySafetyForm(roundItemId, ctx.actor, ctx.isEditor))
  } catch (error) {
    return safetyTaskError(error)
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ roundItemId: string }> }) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const { roundItemId } = await params
    const payload = workflowSchema.parse(await req.json())
    return NextResponse.json(await updateMonthlySafetyPointWorkflow(roundItemId, payload, ctx.actor, ctx.isEditor))
  } catch (error) {
    return safetyTaskError(error)
  }
}
