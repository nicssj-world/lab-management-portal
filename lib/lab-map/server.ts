import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { buildStaffLabMapDTO, type StaffMapRepository } from './server-builder'
import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'
import { listSafetyAssets } from './safety-server'

export interface PublishedLabMapSnapshot {
  versionCode: string
  safetyEquipment: readonly LabSafetyEquipmentDefinition[]
  assemblyPoints: readonly LabAssemblyPointDefinition[]
}

export async function getPublishedLabMapSnapshot(): Promise<PublishedLabMapSnapshot | null> {
  const { data, error } = await supabaseAdmin.from('lab_map_versions')
    .select('version_code, asset_snapshot, assembly_point_snapshot')
    .eq('status', 'published').maybeSingle()
  if (error) throw new Error(`lab map release: ${error.message}`)
  if (!data || !Array.isArray(data.asset_snapshot) || data.asset_snapshot.length === 0) return null
  const workingAssets = await listSafetyAssets(false)
  const liveStatusByCode = new Map(workingAssets.map(asset => [asset.code, asset.operationalStatus]))
  return {
    versionCode: data.version_code as string,
    safetyEquipment: data.asset_snapshot.map((asset: LabSafetyEquipmentDefinition) => ({
      ...asset, operationalStatus: liveStatusByCode.get(asset.code) ?? asset.operationalStatus,
    })),
    assemblyPoints: Array.isArray(data.assembly_point_snapshot) ? data.assembly_point_snapshot : [],
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
  async publishedSnapshots() {
    return getPublishedLabMapSnapshot()
  },
}

export async function getStaffLabMapDTO() {
  const map = await buildStaffLabMapDTO(repository)
  if (map.releaseStatus === 'published') return map
  const workingAssets = await listSafetyAssets(false)
  const liveStatusByCode = new Map(workingAssets.map(asset => [asset.code, asset.operationalStatus]))
  return {
    ...map,
    // คง x/y และชนิดจาก published snapshot แต่ผูกสถานะการตรวจล่าสุดแบบสด
    safetyEquipment: map.safetyEquipment.map(asset => ({
      ...asset, operationalStatus: liveStatusByCode.get(asset.code) ?? asset.operationalStatus,
    })),
  }
}
