import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { normalizeRole } from '@/lib/roles'
import type { Actor } from '@/lib/auth/guards'
import type { MapReleaseDTO } from './types'

export function canManageMapReleases(actor: Actor) {
  return ['Admin', 'Manager'].includes(normalizeRole(actor.role))
}

export function mapReleaseRow(row: Record<string, unknown>): MapReleaseDTO {
  return {
    id: row.id as string,
    versionCode: row.version_code as string,
    status: row.status as MapReleaseDTO['status'],
    manifestHash: row.manifest_hash as string,
    effectiveDate: row.effective_date as string | null,
    reviewedBy: row.reviewed_by as string | null,
    approvedBy: row.approved_by as string | null,
    approvedAt: row.approved_at as string | null,
    notes: row.notes as string | null,
    assetSnapshot: Array.isArray(row.asset_snapshot) && row.asset_snapshot.length > 0
      ? row.asset_snapshot as MapReleaseDTO['assetSnapshot'] : undefined,
    assemblyPointSnapshot: Array.isArray(row.assembly_point_snapshot) && row.assembly_point_snapshot.length > 0
      ? row.assembly_point_snapshot as MapReleaseDTO['assemblyPointSnapshot'] : undefined,
  }
}

export async function auditMapRelease(action: string, actorId: string, id: string, detail?: unknown) {
  const { error } = await supabaseAdmin.from('audit_log').insert({
    action, user_id: actorId, target: id, detail: detail ? JSON.stringify(detail) : null,
  })
  if (error) throw new Error(`audit: ${error.message}`)
}
