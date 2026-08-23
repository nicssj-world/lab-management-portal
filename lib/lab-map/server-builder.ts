import {
  LAB_ACCESS_POINTS, LAB_LABELS, LAB_MAP_VERSION, LAB_MAP_VIEW_BOX, LAB_ROUTE_PRESETS,
  LAB_SPACES, LAB_STATIONS, LAB_STRUCTURES, LAB_ZONES, REQUIRED_SPACE_CODES,
} from './manifest'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import type { StaffLabMapDTO } from './types'
import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'

export interface StaffMapRepository {
  activeSpaceCodes(): Promise<readonly string[]>
  activeZoneCodes(): Promise<readonly string[]>
  liveSafetySnapshot?(): Promise<{
    safetyEquipment: readonly LabSafetyEquipmentDefinition[]
    assemblyPoints: readonly LabAssemblyPointDefinition[]
  } | null>
  publishedSnapshots?(): Promise<{
    safetyEquipment: readonly LabSafetyEquipmentDefinition[]
    assemblyPoints: readonly LabAssemblyPointDefinition[]
    versionCode?: string
  } | null>
}

export interface StaffMapBuildOptions {
  /** Keep the safety-equipment registry out of surfaces that do not own it. */
  includeSafetyEquipment?: boolean
  /** Keep assembly points out of surfaces that do not own evacuation data. */
  includeAssemblyPoints?: boolean
}

export async function buildStaffLabMapDTO(
  repository: StaffMapRepository,
  options: StaffMapBuildOptions = {},
): Promise<StaffLabMapDTO> {
  const includeSafetyEquipment = options.includeSafetyEquipment ?? true
  const includeAssemblyPoints = options.includeAssemblyPoints ?? true
  const [spaceCodes, zoneCodes, published] = await Promise.all([
    repository.activeSpaceCodes(),
    repository.activeZoneCodes(),
    repository.publishedSnapshots?.() ?? Promise.resolve(null),
  ])
  const live = await (repository.liveSafetySnapshot?.() ?? Promise.resolve(null))
  const missingSpaces = REQUIRED_SPACE_CODES.filter((code) => !spaceCodes.includes(code))
  const missingZones = LAB_ZONES.map((zone) => zone.code).filter((code) => !zoneCodes.includes(code))
  if (missingSpaces.length || missingZones.length) {
    throw new Error(`lab map seed drift: spaces=${missingSpaces.join(',')} zones=${missingZones.join(',')}`)
  }

  return {
    version: published?.versionCode ?? LAB_MAP_VERSION,
    releaseStatus: published ? 'published' : 'draft',
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: LAB_STATIONS.find((station) => station.kind === 'installation')?.code ?? 'office',
    structures: LAB_STRUCTURES,
    spaces: LAB_SPACES,
    labels: LAB_LABELS,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    stations: LAB_STATIONS,
    routes: LAB_ROUTE_PRESETS,
    // แผนที่เจ้าหน้าที่ต้องสะท้อนทะเบียนปัจจุบัน แม้ตำแหน่งจะเพิ่งบันทึกและยังรอยืนยัน
    // ส่วน public/print ใช้ getPublishedLabMapSnapshot ซึ่งกรองตามกติกา verified แยกต่างหาก
    safetyEquipment: includeSafetyEquipment
      ? live?.safetyEquipment ?? published?.safetyEquipment ?? LAB_SAFETY_EQUIPMENT
      : [],
    assemblyPoints: includeAssemblyPoints
      ? live?.assemblyPoints ?? published?.assemblyPoints ?? LAB_ASSEMBLY_POINTS
      : [],
  }
}
