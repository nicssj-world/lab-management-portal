import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { activateMonthlySafetyFormTemplate, createMonthlySafetyFormTemplate, listMonthlySafetyFormTemplates } from '@/lib/quality-tasks/monthly-safety-template-server'

const profileSchema = z.enum(['biohazard_spill_kit', 'chemical_spill_kit', 'nss_eyewash'])
const mutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'), profile: profileSchema, titleTh: z.string().trim().min(1).max(240),
    items: z.array(z.object({
      itemKey: z.string().trim().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
      labelTh: z.string().trim().min(1).max(240), expiryRequired: z.boolean(),
      dateMode: z.enum(['none', 'manufactured_or_packed', 'purchased']),
    })).max(100),
  }),
  z.object({ action: z.literal('activate'), templateId: z.string().uuid() }),
])

export async function GET() {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ templates: await listMonthlySafetyFormTemplates() }) }
  catch (error) { return safetyTaskError(error) }
}

export async function POST(req: NextRequest) {
  const ctx = await safetyTaskContext('edit'); if (ctx.response) return ctx.response
  try {
    const input = mutationSchema.parse(await req.json())
    const result = input.action === 'create'
      ? await createMonthlySafetyFormTemplate(input, ctx.actor)
      : await activateMonthlySafetyFormTemplate(input.templateId, ctx.actor)
    return NextResponse.json(result, { status: input.action === 'create' ? 201 : 200 })
  } catch (error) { return safetyTaskError(error) }
}
