import { NextRequest } from 'next/server'
import { requireIt } from '@/lib/it-access/guard'
import { removeBackupAttachment, streamBackupAttachment } from '@/lib/it-access/backup-attachments'

type Params = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await requireIt('view')
  if ('error' in guard) return guard.error
  return streamBackupAttachment((await params).id, req.headers.get('range'))
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await requireIt('edit')
  if ('error' in guard) return guard.error
  return removeBackupAttachment(guard.actor, (await params).id)
}
