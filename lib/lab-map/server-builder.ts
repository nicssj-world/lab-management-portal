import {
  LAB_ACCESS_POINTS, LAB_MAP_VERSION, LAB_MAP_VIEW_BOX, LAB_ROUTE_PRESETS,
  LAB_SPACES, LAB_STATIONS, LAB_ZONES, REQUIRED_SPACE_CODES,
} from './manifest'
import type { Permissions } from '@/lib/permissions'
import type { StaffLabMapDTO, StaffMapPersonDTO } from './types'

export interface MapAssignmentRecord extends StaffMapPersonDTO {}
export interface MapProfileRecord { profileId: string; name: string; department: string | null }
export interface StaffMapRepository {
  activeSpaceCodes(): Promise<readonly string[]>
  activeZoneCodes(): Promise<readonly string[]>
  assignments(): Promise<readonly MapAssignmentRecord[]>
  activeProfiles(): Promise<readonly MapProfileRecord[]>
}

export function canViewMapPersonnel(permissions: Permissions) {
  return permissions['บุคลากร'] === 'view' || permissions['บุคลากร'] === 'edit'
}

export async function buildStaffLabMapDTO(
  permissions: Permissions,
  repository: StaffMapRepository,
): Promise<StaffLabMapDTO> {
  const [spaceCodes, zoneCodes] = await Promise.all([
    repository.activeSpaceCodes(),
    repository.activeZoneCodes(),
  ])
  const missingSpaces = REQUIRED_SPACE_CODES.filter((code) => !spaceCodes.includes(code))
  const missingZones = LAB_ZONES.map((zone) => zone.code).filter((code) => !zoneCodes.includes(code))
  if (missingSpaces.length || missingZones.length) {
    throw new Error(`lab map seed drift: spaces=${missingSpaces.join(',')} zones=${missingZones.join(',')}`)
  }

  const base: StaffLabMapDTO = {
    version: LAB_MAP_VERSION,
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: LAB_STATIONS[0]?.code ?? 'office',
    spaces: LAB_SPACES,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    routes: LAB_ROUTE_PRESETS,
    canEditPersonnelAssignments: permissions['บุคลากร'] === 'edit',
  }
  if (!canViewMapPersonnel(permissions)) return base

  const [people, profiles] = await Promise.all([
    repository.assignments(),
    repository.activeProfiles(),
  ])
  const assignedIds = new Set(people.map((person) => person.profileId))
  return {
    ...base,
    people: [...people],
    unassignedPeople: profiles.filter((profile) => !assignedIds.has(profile.profileId)),
  }
}
