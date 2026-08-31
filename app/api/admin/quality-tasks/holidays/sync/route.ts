import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { jsonForbidden } from '@/lib/auth/guards'
import { isAdminRole } from '@/lib/roles'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { syncGoogleThaiHolidays } from '@/lib/quality-tasks/holidays'

const syncSchema = z.object({
  year: z.number().int().min(2000).max(2100),
})

export async function POST(req: NextRequest) {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  if (!isAdminRole(ctx.actor.role)) return jsonForbidden()

  try {
    const input = syncSchema.parse(await req.json())
    return NextResponse.json(await syncGoogleThaiHolidays(input.year, ctx.actor), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) { return qualityTaskError(error) }
}
