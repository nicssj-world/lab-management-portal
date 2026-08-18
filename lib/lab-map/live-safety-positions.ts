import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'

type LiveSafetyAsset = Pick<
  LabSafetyEquipmentDefinition,
  'code' | 'kind' | 'nameTh' | 'x' | 'y' | 'verified' | 'sourceNoteTh' | 'shutoffFor' | 'operationalStatus'
>

type LiveAssemblyPoint = Pick<
  LabAssemblyPointDefinition,
  'code' | 'nameTh' | 'detailTh' | 'pointType' | 'exitCodes' | 'latitude' | 'longitude' | 'verified'
>

export interface LiveSafetyPositionInput {
  snapshotAssets: readonly LabSafetyEquipmentDefinition[]
  liveAssets: readonly LiveSafetyAsset[]
  snapshotAssemblyPoints: readonly LabAssemblyPointDefinition[]
  liveAssemblyPoints: readonly LiveAssemblyPoint[]
}

export interface LiveSafetyPositionOutput {
  safetyEquipment: LabSafetyEquipmentDefinition[]
  assemblyPoints: LabAssemblyPointDefinition[]
}

/**
 * Keep release history, but project the current safety registry into map views.
 *
 * A changed position is only allowed to replace a release position after the
 * registry marks it verified. Existing release positions remain visible while
 * an edit is pending, but are marked unverified. New unverified records are
 * withheld until they have a verified position. If the live table is empty,
 * the snapshot is preserved as a fail-safe for legacy/partially seeded data.
 */
export function mergeLiveSafetyPositions(input: LiveSafetyPositionInput): LiveSafetyPositionOutput {
  const liveAssetByCode = new Map(input.liveAssets.map((item) => [item.code, item]))
  const liveAssemblyByCode = new Map(input.liveAssemblyPoints.map((item) => [item.code, item]))

  const safetyEquipment = input.snapshotAssets.flatMap<LabSafetyEquipmentDefinition>((snapshot) => {
    const live = liveAssetByCode.get(snapshot.code)
    if (!live) return input.liveAssets.length === 0 ? [snapshot] : []
    if (!live.verified) {
      return [{
        ...snapshot,
        verified: false,
        operationalStatus: live.operationalStatus ?? snapshot.operationalStatus,
      }]
    }
    return [{ ...snapshot, ...live }]
  })

  for (const live of input.liveAssets) {
    if (live.verified && !input.snapshotAssets.some((snapshot) => snapshot.code === live.code)) {
      safetyEquipment.push({ ...live })
    }
  }

  const assemblyPoints = input.snapshotAssemblyPoints.flatMap<LabAssemblyPointDefinition>((snapshot) => {
    const live = liveAssemblyByCode.get(snapshot.code)
    if (!live) return input.liveAssemblyPoints.length === 0 ? [snapshot] : []
    if (!live.verified) return [{ ...snapshot, verified: false }]
    return [{ ...snapshot, ...live }]
  })

  for (const live of input.liveAssemblyPoints) {
    if (live.verified && !input.snapshotAssemblyPoints.some((snapshot) => snapshot.code === live.code)) {
      assemblyPoints.push({ ...live })
    }
  }

  return { safetyEquipment, assemblyPoints }
}
