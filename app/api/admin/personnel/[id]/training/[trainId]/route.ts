import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { TrainingSchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ trainId: string }> }) {
  const { trainId } = await ctx.params
  return updateChild(req, 'staff_training', trainId, TrainingSchema)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ trainId: string }> }) {
  const { trainId } = await ctx.params
  return softDeleteChild('staff_training', trainId)
}
