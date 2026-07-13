import { supabaseAdmin } from '@/lib/supabase/admin'
import type { ActiveIncomingSetMembership, RegistrationSetMode } from './registration-set-contracts'

type LinkRow = {
  document_id: string
  set_mode: string | null
  set_draft_id: string | null
}

async function enrichActiveMains(links: LinkRow[]): Promise<ActiveIncomingSetMembership[]> {
  const mainIds = Array.from(new Set(links.map((link) => link.document_id)))
  if (mainIds.length === 0) return []
  const mains = await supabaseAdmin
    .from('documents')
    .select('id, document_code, status')
    .in('id', mainIds)
    .in('status', ['Draft', 'Review', 'Approved'])
    .is('deleted_at', null)
  if (mains.error) throw mains.error
  const mainById = new Map((mains.data ?? []).map((main) => [main.id, main] as const))
  return links.flatMap((link) => {
    const main = mainById.get(link.document_id)
    if (!main || !link.set_mode) return []
    return [{
      mainDocumentId: main.id,
      mainDocumentCode: main.document_code,
      mainStatus: main.status as ActiveIncomingSetMembership['mainStatus'],
      setMode: link.set_mode as RegistrationSetMode,
      setDraftId: link.set_draft_id,
    }]
  })
}

export async function getActiveIncomingDocumentSetMemberships(documentId: string) {
  const links = await supabaseAdmin
    .from('document_links')
    .select('document_id, set_mode, set_draft_id')
    .eq('linked_doc_id', documentId)
    .eq('link_kind', 'set')
  if (links.error) throw links.error
  return enrichActiveMains(links.data ?? [])
}

export async function getActiveOwnedRevisionSetMemberships(draftId: string) {
  const links = await supabaseAdmin
    .from('document_links')
    .select('document_id, set_mode, set_draft_id')
    .eq('link_kind', 'set')
    .eq('set_mode', 'revision')
    .eq('set_draft_id', draftId)
  if (links.error) throw links.error
  return enrichActiveMains(links.data ?? [])
}
