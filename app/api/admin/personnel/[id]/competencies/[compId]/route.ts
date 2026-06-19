import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { CompetencySchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; compId: string }> }) {
  const { id, compId } = await ctx.params
  return updateChild(req, 'staff_competencies', compId, CompetencySchema, id)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; compId: string }> }) {
  const { id, compId } = await ctx.params
  return softDeleteChild('staff_competencies', compId, id)
}
