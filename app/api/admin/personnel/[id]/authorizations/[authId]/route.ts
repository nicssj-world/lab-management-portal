import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { AuthorizationBaseSchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ authId: string }> }) {
  const { authId } = await ctx.params
  return updateChild(req, 'staff_authorizations', authId, AuthorizationBaseSchema)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ authId: string }> }) {
  const { authId } = await ctx.params
  return softDeleteChild('staff_authorizations', authId)
}
