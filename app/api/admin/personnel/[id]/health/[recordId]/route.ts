import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { HealthRecordSchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; recordId: string }> }) {
  const { id, recordId } = await ctx.params
  return updateChild(req, 'staff_health_records', recordId, HealthRecordSchema, id, { fileColumns: ['evidence_url'] })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; recordId: string }> }) {
  const { id, recordId } = await ctx.params
  return softDeleteChild('staff_health_records', recordId, id)
}
