import { NextRequest } from 'next/server'
import { updateChild, softDeleteChild } from '@/lib/personnel/crud'
import { ConfidentialitySchema } from '@/lib/validations/personnel'

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string; agreementId: string }> }) {
  const { id, agreementId } = await ctx.params
  return updateChild(req, 'staff_confidentiality_agreements', agreementId, ConfidentialitySchema, id, { fileColumns: ['file_url'] })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; agreementId: string }> }) {
  const { id, agreementId } = await ctx.params
  return softDeleteChild('staff_confidentiality_agreements', agreementId, id)
}
