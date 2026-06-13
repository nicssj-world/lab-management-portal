import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { CertificationSchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ certId: string }> }) {
  const { certId } = await ctx.params
  return updateChild(req, 'staff_certifications', certId, CertificationSchema)
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ certId: string }> }) {
  const { certId } = await ctx.params
  return softDeleteChild('staff_certifications', certId)
}
