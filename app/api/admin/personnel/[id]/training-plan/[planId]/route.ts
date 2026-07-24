import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { TrainingPlanSchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await ctx.params
  return updateChild(req, 'staff_training_plan', planId, TrainingPlanSchema, id, { access: 'manage' })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; planId: string }> }) {
  const { id, planId } = await ctx.params
  return softDeleteChild('staff_training_plan', planId, id, 'manage')
}
