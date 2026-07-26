import { createHash } from 'node:crypto'
import {
  LAB_ACCESS_POINTS, LAB_LABELS, LAB_MAP_VERSION, LAB_ROUTE_PRESETS, LAB_SPACES,
  LAB_STATIONS, LAB_STRUCTURES, LAB_ZONES,
} from './manifest'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import { validateLabMapManifest } from './validate'
import type { MapReleaseDTO } from './types'
import type { LabAssemblyPointDefinition, LabSafetyEquipmentDefinition } from './types'

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, canonicalize(nested)]))
  }
  return value
}

export function computeManifestHash(input: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalize(input))).digest('hex')
}

function manifestValue(
  safetyEquipment: readonly LabSafetyEquipmentDefinition[],
  assemblyPoints: readonly LabAssemblyPointDefinition[],
) {
  return {
    version: LAB_MAP_VERSION,
    structures: LAB_STRUCTURES,
    spaces: LAB_SPACES,
    labels: LAB_LABELS,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    stations: LAB_STATIONS,
    routes: LAB_ROUTE_PRESETS,
    safetyEquipment,
    assemblyPoints,
  }
}

export function manifestHashForSnapshots(
  safetyEquipment: readonly LabSafetyEquipmentDefinition[],
  assemblyPoints: readonly LabAssemblyPointDefinition[],
) {
  return computeManifestHash(manifestValue(safetyEquipment, assemblyPoints))
}

export function currentManifestHash() {
  // Legacy/static hash remains available for releases created before database snapshots.
  return manifestHashForSnapshots(LAB_SAFETY_EQUIPMENT, LAB_ASSEMBLY_POINTS)
}

export function validatePublishableRelease(input: MapReleaseDTO): string[] {
  const blockers = [...validateLabMapManifest()]
  const safetyEquipment = input.assetSnapshot ?? LAB_SAFETY_EQUIPMENT
  const assemblyPoints = input.assemblyPointSnapshot ?? LAB_ASSEMBLY_POINTS
  if (!input.versionCode.trim()) blockers.push('กรุณาระบุรหัสเวอร์ชัน')
  if (!input.effectiveDate) blockers.push('กรุณาระบุวันที่มีผล')
  if (!input.reviewedBy) blockers.push('กรุณาระบุผู้ทบทวน')
  if (!input.approvedBy) blockers.push('กรุณาระบุผู้อนุมัติ')
  if (!input.approvedAt) blockers.push('กรุณาระบุเวลาที่อนุมัติ')
  if (input.reviewedBy && input.reviewedBy === input.approvedBy) blockers.push('ผู้ทบทวนและผู้อนุมัติต้องเป็นคนละคน')
  if (safetyEquipment.some((item) => !item.verified)) {
    blockers.push('ยังไม่ได้ยืนยันตำแหน่งอุปกรณ์ความปลอดภัยหน้างาน')
  }
  if (assemblyPoints.some((item) => !item.verified || item.latitude == null || item.longitude == null || item.exitCodes.length === 0)) {
    blockers.push('จุดรวมพลยังยืนยันไม่ครบ ต้องมี GPS รูปหลักฐาน และทางออกอย่างน้อยหนึ่งจุด')
  }
  if (input.manifestHash !== manifestHashForSnapshots(safetyEquipment, assemblyPoints)) blockers.push('ฉบับร่างไม่ตรงกับผังในระบบปัจจุบัน')
  for (const station of LAB_STATIONS) {
    for (const variant of ['primary', 'alternate'] as const) {
      const hasPreset = LAB_ROUTE_PRESETS.some(
        (route) => route.kind === 'evacuation' && route.variant === variant && route.fromStationCode === station.code,
      )
      if (!hasPreset) blockers.push(`ไม่มีเส้นทางหนีไฟ (${variant}) ที่อนุมัติสำหรับ ${station.nameTh}`)
    }
  }
  const lockedPointCodes = new Set(
    LAB_ACCESS_POINTS.filter((point) => point.status === 'permanently_locked').map((point) => point.code),
  )
  if (LAB_ROUTE_PRESETS.some((route) => route.pointCodes.some((code) => lockedPointCodes.has(code)))) {
    blockers.push('เส้นทางมีประตูที่ล็อคถาวร')
  }
  // ตำแหน่งถังดับเพลิงแปลงมาจากผังฉบับเก่าโดยประมาณ — ห้ามเผยแพร่เป็นฉบับใช้งานจริง
  // จนกว่าเจ้าหน้าที่ความปลอดภัยจะเดินสำรวจยืนยันหน้างานครบทุกจุด
  return [...new Set(blockers)]
}

export function isOfficialRelease(input: MapReleaseDTO) {
  return input.status === 'published' && validatePublishableRelease(input).length === 0
}
