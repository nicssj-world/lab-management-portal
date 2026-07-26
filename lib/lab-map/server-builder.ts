import {
  LAB_ACCESS_POINTS, LAB_LABELS, LAB_MAP_VERSION, LAB_MAP_VIEW_BOX, LAB_ROUTE_PRESETS,
  LAB_SPACES, LAB_STATIONS, LAB_STRUCTURES, LAB_ZONES, REQUIRED_SPACE_CODES,
} from './manifest'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import type { StaffLabMapDTO } from './types'

export interface StaffMapRepository {
  activeSpaceCodes(): Promise<readonly string[]>
  activeZoneCodes(): Promise<readonly string[]>
}

export async function buildStaffLabMapDTO(repository: StaffMapRepository): Promise<StaffLabMapDTO> {
  const [spaceCodes, zoneCodes] = await Promise.all([
    repository.activeSpaceCodes(),
    repository.activeZoneCodes(),
  ])
  const missingSpaces = REQUIRED_SPACE_CODES.filter((code) => !spaceCodes.includes(code))
  const missingZones = LAB_ZONES.map((zone) => zone.code).filter((code) => !zoneCodes.includes(code))
  if (missingSpaces.length || missingZones.length) {
    throw new Error(`lab map seed drift: spaces=${missingSpaces.join(',')} zones=${missingZones.join(',')}`)
  }

  return {
    version: LAB_MAP_VERSION,
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: LAB_STATIONS.find((station) => station.kind === 'installation')?.code ?? 'office',
    structures: LAB_STRUCTURES,
    spaces: LAB_SPACES,
    labels: LAB_LABELS,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    stations: LAB_STATIONS,
    routes: LAB_ROUTE_PRESETS,
    safetyEquipment: LAB_SAFETY_EQUIPMENT,
    assemblyPoints: LAB_ASSEMBLY_POINTS,
  }
}
