import { NextResponse } from 'next/server'
import { requireSafetyViewer, isSafetyEditor } from '@/lib/lab-map/safety-access'

export async function safetyTaskContext(minimum: 'view' | 'edit' = 'view') {
  const guarded = await requireSafetyViewer()
  if (guarded.response) return { response: guarded.response }
  const editor = await isSafetyEditor(guarded.actor)
  if (minimum === 'edit' && !editor) return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { actor: guarded.actor, level: editor ? 'edit' as const : 'view' as const, isEditor: editor }
}

export function safetyTaskError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected error'
  const status = message === 'Forbidden' ? 403 : /not found/i.test(message) ? 404 : 422
  return NextResponse.json({ error: message }, { status })
}
