import { NextRequest } from 'next/server'
import { listChildren, createChild } from '@/lib/personnel/crud'
import { TrainingSchema } from '@/lib/validations/personnel'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return listChildren('staff_training', id)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return createChild(req, 'staff_training', id, TrainingSchema)
}
