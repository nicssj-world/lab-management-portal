import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'

export const PUBLIC_SAFETY_MANUAL_CODES = ['MN-LAB-02'] as const

export function isAllowedPublicSafetyManualCode(code: string) {
  return PUBLIC_SAFETY_MANUAL_CODES.includes(code.trim().toUpperCase() as 'MN-LAB-02')
}

export async function resolvePublicSafetyManual(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!isAllowedPublicSafetyManualCode(normalized)) return null
  const { data } = await supabaseAdmin.from('documents')
    .select('document_code, title, revision, effective_date, file_url, file_name, mime_type')
    .eq('document_code', normalized).eq('status', 'Published').is('deleted_at', null).not('file_url', 'is', null).maybeSingle()
  if (!data?.file_url) return null
  return {
    code: data.document_code, title: data.title, revision: data.revision ?? null,
    effectiveOn: data.effective_date ?? null, r2Key: data.file_url,
    fileName: data.file_name || `${normalized}.pdf`, contentType: data.mime_type || 'application/pdf',
  }
}
