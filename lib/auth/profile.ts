import type { User } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase/admin'

export type OwnProfile = {
  id: string
  name: string
  role: string
  dept: string | null
  phone: string | null
  avatar_url: string | null
  doc_role: string | null
  document_position: string | null
  signature_url: string | null
  signature_updated_at: string | null
}

const FULL_SELECT = 'id, name, role, dept, phone, avatar_url, doc_role, document_position, signature_url, signature_updated_at'
const BASIC_SELECT = 'id, name, role, dept'

function isNoRows(error: { code?: string; message?: string } | null) {
  return error?.code === 'PGRST116' || error?.message?.toLowerCase().includes('no rows')
}

function withOptionalColumns(row: Partial<OwnProfile> & Pick<OwnProfile, 'id' | 'name' | 'role'>): OwnProfile {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    dept: row.dept ?? null,
    phone: row.phone ?? null,
    avatar_url: row.avatar_url ?? null,
    doc_role: row.doc_role ?? null,
    document_position: row.document_position ?? null,
    signature_url: row.signature_url ?? null,
    signature_updated_at: row.signature_updated_at ?? null,
  }
}

function fallbackName(user: User) {
  const meta = user.user_metadata ?? {}
  const name = meta.name ?? meta.full_name ?? meta.display_name
  if (typeof name === 'string' && name.trim()) return name.trim()
  return user.email?.split('@')[0] || 'User'
}

function fallbackEphisId(user: User) {
  const local = user.email?.split('@')[0] ?? ''
  return /^\d+$/.test(local) ? local : null
}

export async function getOwnProfile(userId: string): Promise<OwnProfile | null> {
  const full = await supabaseAdmin
    .from('profiles')
    .select(FULL_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (!full.error) return full.data ? withOptionalColumns(full.data as OwnProfile) : null
  if (isNoRows(full.error)) return null

  const basic = await supabaseAdmin
    .from('profiles')
    .select(BASIC_SELECT)
    .eq('id', userId)
    .maybeSingle()

  if (basic.error) {
    if (isNoRows(basic.error)) return null
    throw basic.error
  }
  return basic.data ? withOptionalColumns(basic.data as Pick<OwnProfile, 'id' | 'name' | 'role' | 'dept'>) : null
}

export async function ensureOwnProfile(user: User): Promise<OwnProfile> {
  const existing = await getOwnProfile(user.id)
  if (existing) return existing

  const name = fallbackName(user)
  const ephisId = fallbackEphisId(user)
  const attempts: Record<string, unknown>[] = [
    { id: user.id, name, role: 'Assistant', dept: null, status: 'active', ephis_id: ephisId },
    { id: user.id, name, role: 'Assistant', dept: null, status: 'active' },
    { id: user.id, name, role: 'Assistant', dept: null },
  ]

  let lastError: unknown = null
  for (const payload of attempts) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .insert(payload)
      .select(BASIC_SELECT)
      .single()

    if (!error && data) return withOptionalColumns(data as Pick<OwnProfile, 'id' | 'name' | 'role' | 'dept'>)
    lastError = error

    const recovered = await getOwnProfile(user.id)
    if (recovered) return recovered
  }

  if (lastError && typeof lastError === 'object' && 'message' in lastError) {
    throw new Error(String(lastError.message))
  }
  throw new Error('Unable to create profile')
}
