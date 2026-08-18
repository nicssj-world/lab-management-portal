import 'server-only'

import { deriveSafetyAssetStatus } from './safety-domain'
import type {
  AssemblyPointDTO, AssemblyPointVerificationDTO, SafetyAssetDTO, SafetyInspectionDTO,
} from './types'
import { todayBangkok } from '@/lib/risk/register'
import { supabaseAdmin } from '@/lib/supabase/admin'

type ExpiryCorrection = { expiresOn: string | null }

function inspectionRow(row: Record<string, unknown>, correction?: ExpiryCorrection): SafetyInspectionDTO {
  return {
    id: String(row.id), assetId: String(row.asset_id), result: row.result as SafetyInspectionDTO['result'],
    inspectedOn: String(row.inspected_on), nextInspectionDate: row.next_inspection_date as string | null,
    expiresOn: correction ? correction.expiresOn : row.expires_on as string | null, note: row.note as string | null,
    photoUrl: row.photo_r2_key ? `/api/admin/lab-map/safety-inspections/${row.id}/photo` : null,
    inspectedBy: String(row.inspected_by), inspectorName: null, createdAt: String(row.created_at),
  }
}

export async function listSafetyAssets(includeRetired = false): Promise<SafetyAssetDTO[]> {
  let assetsQuery = supabaseAdmin.from('lab_map_safety_assets').select('*')
  if (!includeRetired) assetsQuery = assetsQuery.eq('lifecycle_status', 'active')
  const [{ data: assets, error }, { data: inspections, error: inspectionError }, { data: corrections, error: correctionError }] = await Promise.all([
    assetsQuery,
    supabaseAdmin.from('lab_map_safety_inspections').select('*').is('superseded_at', null).order('inspected_on', { ascending: false }).order('created_at', { ascending: false }),
    supabaseAdmin.from('lab_map_safety_inspection_expiry_corrections').select('inspection_id, expires_on').order('corrected_at', { ascending: false }).order('id', { ascending: false }),
  ])
  if (error) throw new Error(error.message)
  if (inspectionError) throw new Error(inspectionError.message)
  if (correctionError) throw new Error(correctionError.message)

  const correctionByInspection = new Map<string, ExpiryCorrection>()
  for (const row of corrections ?? []) {
    const key = String(row.inspection_id)
    if (!correctionByInspection.has(key)) correctionByInspection.set(key, { expiresOn: row.expires_on as string | null })
  }
  const inspectorIds = [...new Set((inspections ?? []).map(row => String(row.inspected_by)))]
  const { data: profiles, error: profileError } = inspectorIds.length
    ? await supabaseAdmin.from('profiles').select('id, name').in('id', inspectorIds)
    : { data: [], error: null }
  if (profileError) throw new Error(profileError.message)
  const inspectorNameById = new Map((profiles ?? []).map(profile => [String(profile.id), profile.name as string | null]))
  const latestByAsset = new Map<string, SafetyInspectionDTO>()
  for (const row of inspections ?? []) {
    const key = String(row.asset_id)
    if (!latestByAsset.has(key)) {
      const inspection = inspectionRow(row, correctionByInspection.get(String(row.id)))
      inspection.inspectorName = inspectorNameById.get(String(row.inspected_by)) ?? null
      latestByAsset.set(key, inspection)
    }
  }

  const sortedAssets = [...(assets ?? [])].sort((a, b) =>
    String(a.name_th).localeCompare(String(b.name_th), 'th', { numeric: true }))

  return sortedAssets.map(row => {
    const latestInspection = latestByAsset.get(String(row.id)) ?? null
    const positionStatus = row.position_status as SafetyAssetDTO['positionStatus']
    return {
      id: String(row.id), code: String(row.code), nameTh: String(row.name_th),
      kind: row.kind as SafetyAssetDTO['kind'], x: Number(row.x), y: Number(row.y),
      verified: positionStatus === 'verified', sourceNoteTh: row.source_note_th as string | undefined,
      shutoffFor: row.shutoff_for as SafetyAssetDTO['shutoffFor'], spaceCode: row.space_code as string | null,
      department: row.department as string | null,
      positionStatus, lifecycleStatus: row.lifecycle_status as SafetyAssetDTO['lifecycleStatus'],
      inspectionProfile: row.inspection_profile as SafetyAssetDTO['inspectionProfile'],
      activatedOn: String(row.activated_on),
      positionVerifiedBy: row.position_verified_by as string | null,
      positionVerifiedAt: row.position_verified_at as string | null,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at), latestInspection,
      operationalStatus: deriveSafetyAssetStatus({
        positionStatus,
        latestResult: latestInspection?.result,
        nextInspectionDate: latestInspection?.nextInspectionDate,
        expiresOn: latestInspection?.expiresOn,
      }, todayBangkok()),
    }
  })
}

function verificationRow(row: Record<string, unknown>): AssemblyPointVerificationDTO {
  return {
    id: String(row.id), assemblyPointId: String(row.assembly_point_id),
    latitude: Number(row.latitude), longitude: Number(row.longitude),
    accuracyMeters: row.accuracy_meters == null ? null : Number(row.accuracy_meters),
    note: row.note as string | null,
    photoUrl: `/api/admin/lab-map/assembly-verifications/${row.id}/photo`,
    verifiedBy: String(row.verified_by), verifierName: null, verifiedAt: String(row.verified_at),
  }
}

export async function listAssemblyPoints(includeRetired = false): Promise<AssemblyPointDTO[]> {
  let pointsQuery = supabaseAdmin.from('lab_map_assembly_points').select('*').order('name_th')
  if (!includeRetired) pointsQuery = pointsQuery.eq('lifecycle_status', 'active')
  const [{ data: points, error }, { data: exits, error: exitError }, { data: verifications, error: verificationError }] = await Promise.all([
    pointsQuery,
    supabaseAdmin.from('lab_map_assembly_point_exits').select('*'),
    supabaseAdmin.from('lab_map_assembly_point_verifications').select('*').order('verified_at', { ascending: false }),
  ])
  if (error) throw new Error(error.message)
  if (exitError) throw new Error(exitError.message)
  if (verificationError) throw new Error(verificationError.message)
  const exitsByPoint = new Map<string, string[]>()
  for (const row of exits ?? []) {
    const key = String(row.assembly_point_id)
    exitsByPoint.set(key, [...(exitsByPoint.get(key) ?? []), String(row.exit_code)])
  }
  const latestByPoint = new Map<string, AssemblyPointVerificationDTO>()
  for (const row of verifications ?? []) {
    const key = String(row.assembly_point_id)
    if (!latestByPoint.has(key)) latestByPoint.set(key, verificationRow(row))
  }
  return (points ?? []).map(row => ({
    id: String(row.id), code: String(row.code), nameTh: String(row.name_th),
    detailTh: row.detail_th as string | undefined,
    pointType: row.point_type === 'safe' ? 'safe' : 'assembly',
    exitCodes: exitsByPoint.get(String(row.id)) ?? [],
    latitude: row.latitude == null ? null : Number(row.latitude),
    longitude: row.longitude == null ? null : Number(row.longitude),
    verified: row.position_status === 'verified',
    positionStatus: row.position_status as AssemblyPointDTO['positionStatus'],
    lifecycleStatus: row.lifecycle_status as AssemblyPointDTO['lifecycleStatus'],
    positionVerifiedBy: row.position_verified_by as string | null,
    positionVerifiedAt: row.position_verified_at as string | null,
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    latestVerification: latestByPoint.get(String(row.id)) ?? null,
  }))
}

export async function safetyAssetSnapshot() {
  return (await listSafetyAssets(false)).map(item => ({
    code: item.code, kind: item.kind, nameTh: item.nameTh, x: item.x, y: item.y,
    verified: item.verified, sourceNoteTh: item.sourceNoteTh, shutoffFor: item.shutoffFor,
  }))
}

export async function assemblyPointSnapshot() {
  return (await listAssemblyPoints(false)).map(item => ({
    code: item.code, nameTh: item.nameTh, detailTh: item.detailTh, pointType: item.pointType ?? 'assembly', exitCodes: item.exitCodes,
    latitude: item.latitude, longitude: item.longitude, verified: item.verified,
  }))
}

export { inspectionRow, verificationRow }
