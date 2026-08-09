import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { submitMonthlySafetyInspection } from '@/lib/quality-tasks/monthly-safety-server'

const nullableText = z.string().trim().max(2000).nullable().optional().default(null)
const replacementSchema = z.object({
  oldSupplyId: z.string().uuid(),
  internalCode: z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  labelTh: z.string().trim().min(1).max(200),
  manufacturedOrPackedOn: z.string().date().nullable(), purchasedOn: z.string().date().nullable(),
  expiresOn: z.string().date().nullable(), supplier: z.string().trim().max(300).nullable(),
})
const submitSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('spill_kit'),
    inspectedOn: z.string().date(),
    answers: z.array(z.object({
      supplyId: z.string().uuid(),
      itemKey: z.string().trim().min(1).max(160),
      result: z.enum(['normal', 'missing', 'damaged', 'expired', 'na']),
      expiresOn: z.string().date().nullable(),
      note: nullableText,
    })).min(1),
    correctiveAction: nullableText,
    replacements: z.array(replacementSchema).max(100).default([]),
  }),
  z.object({
    kind: z.literal('nss'),
    activeBottleIds: z.array(z.string().uuid()).default([]),
    bottles: z.array(z.object({
      supplyId: z.string().uuid(),
      clarity: z.enum(['clear', 'turbid']),
      bottleCondition: z.enum(['intact', 'cracked']),
      correctiveAction: nullableText,
    })).min(1),
    replacements: z.array(replacementSchema).max(100).default([]),
  }),
])

export async function POST(req: NextRequest, { params }: { params: Promise<{ roundItemId: string }> }) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const { roundItemId } = await params
    const payload = submitSchema.parse(await req.json())
    return NextResponse.json(await submitMonthlySafetyInspection(roundItemId, payload, ctx.actor, ctx.isEditor), { status: 201 })
  } catch (error) {
    return safetyTaskError(error)
  }
}
