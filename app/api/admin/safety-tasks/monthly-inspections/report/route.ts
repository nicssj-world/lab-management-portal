import { NextRequest } from 'next/server'
import { z } from 'zod'
import { safetyTaskContext, safetyTaskError } from '@/lib/quality-tasks/safety-api'
import { getMonthlySafetyReportRows } from '@/lib/quality-tasks/monthly-safety-server'
import { createMonthlySafetyReportPdf } from '@/lib/quality-tasks/monthly-safety-pdf'

const reportQuerySchema = z.object({
  fiscalYear: z.coerce.number().int().min(2500).max(3000),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  assetId: z.string().uuid().optional(),
  roundItemId: z.string().uuid().optional(),
})

export async function GET(req: NextRequest) {
  const ctx = await safetyTaskContext('view'); if (ctx.response) return ctx.response
  try {
    const input = reportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams))
    const rows = await getMonthlySafetyReportRows(input.fiscalYear, ctx.actor, ctx.isEditor, input)
    const pdf = await createMonthlySafetyReportPdf({ fiscalYear: input.fiscalYear, rows })
    const suffix = input.month ? `-${input.month}` : ''
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="monthly-safety-fy${input.fiscalYear}${suffix}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    return safetyTaskError(error)
  }
}
