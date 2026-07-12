import { NextResponse } from 'next/server'
import { getPermissionLevel, requireResource } from '@/lib/auth/guards'

export async function qualityTaskContext(minimum: 'view' | 'edit' = 'view') {
  const guarded = await requireResource('งานคุณภาพ', minimum)
  if (guarded.response) return { response: guarded.response }
  return { actor: guarded.actor, level: await getPermissionLevel(guarded.actor, 'งานคุณภาพ') }
}

export function qualityTaskError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = message === 'Forbidden' ? 403 : /not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}

