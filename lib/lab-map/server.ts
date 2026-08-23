import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildStaffLabMapDTO, type StaffMapBuildOptions, type StaffMapRepository } from './server-builder'
import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'
import { listAssemblyPoints, listSafetyAssets } from './safety-server'
import { mergeLiveSafetyPositions } from './live-safety-positions'

export interface PublishedLabMapSnapshot {
  versionCode: string
  safetyEquipment: readonly LabSafetyEquipmentDefinition[]
  assemblyPoints: readonly LabAssemblyPointDefinition[]
}

export async function getPublishedLabMapSnapshot(): Promise<PublishedLabMapSnapshot | null> {
  const { data, error } = await supabaseAdmin.from('lab_map_versions')
    .select('version_code, asset_snapshot, assembly_point_snapshot')
    .eq('status', 'published').not('effective_date', 'is', null).maybeSingle()
  if (error) throw new Error(`lab map release: ${error.message}`)
  if (!data || !Array.isArray(data.asset_snapshot) || data.asset_snapshot.length === 0) return null
  const [workingAssets, workingAssemblyPoints] = await Promise.all([
    listSafetyAssets(false),
    listAssemblyPoints(false),
  ])
  const current = mergeLiveSafetyPositions({
    snapshotAssets: data.asset_snapshot as LabSafetyEquipmentDefinition[],
    liveAssets: workingAssets,
    snapshotAssemblyPoints: Array.isArray(data.assembly_point_snapshot)
      ? data.assembly_point_snapshot as LabAssemblyPointDefinition[]
      : [],
    liveAssemblyPoints: workingAssemblyPoints,
  })
  return {
    versionCode: data.version_code as string,
    safetyEquipment: current.safetyEquipment,
    assemblyPoints: current.assemblyPoints,
  }
}

const repository: StaffMapRepository = {
  async activeSpaceCodes() {
    const { data, error } = await supabaseAdmin.from('lab_map_spaces').select('code').eq('is_active', true)
    if (error) throw new Error(`lab map spaces: ${error.message}`)
    return (data ?? []).map((row) => row.code as string)
  },
  async activeZoneCodes() {
    const { data, error } = await supabaseAdmin.from('lab_map_zones').select('code').eq('is_active', true)
    if (error) throw new Error(`lab map zones: ${error.message}`)
    return (data ?? []).map((row) => row.code as string)
  },
  async liveSafetySnapshot() {
    const [safetyEquipment, assemblyPoints] = await Promise.all([
      listSafetyAssets(false),
      listAssemblyPoints(false),
    ])
    return { safetyEquipment, assemblyPoints }
  },
  async publishedSnapshots() {
    return getPublishedLabMapSnapshot()
  },
}

export async function getStaffLabMapDTO(options?: StaffMapBuildOptions) {
  return buildStaffLabMapDTO(repository, options)
}
