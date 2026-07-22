import { NextRequest } from 'next/server'
import { removeAttachment, requireAttachmentReader, requireAttachmentWriter, streamAttachment } from '@/lib/risk/attachments'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireAttachmentReader()
  if (guard.error) return guard.error
  const { id } = await params
  return streamAttachment(id, req.headers.get('range'))
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireAttachmentWriter()
  if (guard.error) return guard.error
  const { id } = await params
  return removeAttachment(guard.actor, id)
}
