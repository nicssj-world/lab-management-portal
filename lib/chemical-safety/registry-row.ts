import type { ChemicalStorageScope } from './types'

export interface ChemicalPlacementInput {
  storage_scope?: unknown
  location_id?: unknown
}

export interface ChemicalPlacementLocation {
  id?: unknown
  code?: unknown
}

export interface ChemicalPlacement {
  storageScope: ChemicalStorageScope
  locationId: string | null
  positionCode: string | null
}

/**
 * Department holdings deliberately have no physical storage location. Keeping
 * this normalization in one pure helper prevents null locations from leaking
 * into the room map or being rendered as a missing room assignment.
 */
export function mapChemicalPlacement(
  holding: ChemicalPlacementInput,
  location: ChemicalPlacementLocation | null | undefined,
): ChemicalPlacement {
  if (holding.storage_scope === 'department') {
    return { storageScope: 'department', locationId: null, positionCode: null }
  }

  return {
    storageScope: 'room',
    locationId: location?.id == null ? null : String(location.id),
    positionCode: location?.code == null ? null : String(location.code),
  }
}
