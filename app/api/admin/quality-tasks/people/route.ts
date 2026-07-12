import { NextResponse } from 'next/server'
import { qualityTaskContext, qualityTaskError } from '@/lib/quality-tasks/api'
import { listTaskPeople } from '@/lib/quality-tasks/server'

export async function GET() {
  const ctx = await qualityTaskContext('view'); if (ctx.response) return ctx.response
  try { return NextResponse.json({ people: await listTaskPeople() }) } catch (error) { return qualityTaskError(error) }
}
