import { NextRequest } from 'next/server'
import { removeAttachment, requireAttachmentReader, requireAttachmentWriter, streamAttachment } from '@/lib/risk/attachments'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requireAttachmentReader({ attachmentId: id })
  if (guard.error) return guard.error
  return streamAttachment(id, req.headers.get('range'))
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const guard = await requireAttachmentWriter({ attachmentId: id })
  if (guard.error) return guard.error
  return removeAttachment(guard.actor, id)
}
