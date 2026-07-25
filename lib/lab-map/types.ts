export type InfectionClass = 'infectious' | 'clean' | 'risk'

export type AccessPointStatus =
  | 'open'
  | 'fingerprint_controlled'
  | 'permanently_locked'

export type MapMode = 'overview' | 'infection' | 'safety' | 'personnel'

export type RouteKind = 'visitor' | 'staff_orientation' | 'evacuation'

export type RouteVariant = 'primary' | 'alternate'

export type SvgShape =
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'polygon'; points: ReadonlyArray<readonly [number, number]> }
  | { type: 'path'; d: string }

export interface LabSpaceDefinition {
  code: string
  nameTh: string
  nameEn?: string
  shape: SvgShape
  infectionClass: InfectionClass
  workUnits: readonly string[]
  controlled: boolean
}

export interface LabZoneDefinition {
  code: string
  nameTh: string
  spaceCodes: readonly string[]
  workUnits: readonly string[]
}

export interface LabAccessPointDefinition {
  code: string
  nameTh: string
  kind: 'fingerprint' | 'door' | 'exit'
  status: AccessPointStatus
  x: number
  y: number
}

export interface LabStationDefinition {
  code: string
  nameTh: string
  x: number
  y: number
}

export interface LabRoutePreset {
  code: string
  kind: RouteKind
  variant: RouteVariant
  fromStationCode: string
  destinationCode: string
  pointCodes: readonly string[]
  polyline: ReadonlyArray<readonly [number, number]>
  directionsTh: readonly string[]
}

export interface LabMapSpaceDTO extends Omit<LabSpaceDefinition, 'infectionClass'> {
  infectionClass?: InfectionClass
}

export interface LabMapDTO {
  version: string
  viewBox: string
  stationCode: string
  spaces: readonly LabMapSpaceDTO[]
  zones: readonly LabZoneDefinition[]
  accessPoints: readonly LabAccessPointDefinition[]
  routes: readonly LabRoutePreset[]
}

export interface RoutePresetLookup {
  kind: RouteKind
  stationCode: string
  destinationCode: string
  variant?: RouteVariant
}

export type MapPersonnelAssignmentType = 'primary' | 'responsible'

export interface StaffMapPersonDTO {
  assignmentId: string
  profileId: string
  name: string
  department: string | null
  assignmentType: MapPersonnelAssignmentType
  spaceCode: string | null
  zoneCode: string | null
}

export interface StaffLabMapDTO extends LabMapDTO {
  canEditPersonnelAssignments: boolean
  people?: readonly StaffMapPersonDTO[]
  unassignedPeople?: readonly Pick<StaffMapPersonDTO, 'profileId' | 'name' | 'department'>[]
}
