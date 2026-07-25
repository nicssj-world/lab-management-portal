import { createHash } from 'node:crypto'
import {
  LAB_ACCESS_POINTS, LAB_MAP_VERSION, LAB_ROUTE_PRESETS, LAB_SPACES, LAB_STATIONS, LAB_ZONES,
} from './manifest'
import { PUBLIC_LAB_ACCESS_POINTS, PUBLIC_LAB_ROUTES, PUBLIC_LAB_SPACES, PUBLIC_LAB_ZONES } from './public-manifest'
import { validateLabMapManifest } from './validate'
import type { MapReleaseDTO } from './types'

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

export function currentManifestHash() {
  return computeManifestHash({
    version: LAB_MAP_VERSION,
    spaces: LAB_SPACES,
    zones: LAB_ZONES,
    accessPoints: LAB_ACCESS_POINTS,
    stations: LAB_STATIONS,
    routes: LAB_ROUTE_PRESETS,
    publicProjection: {
      spaces: PUBLIC_LAB_SPACES,
      zones: PUBLIC_LAB_ZONES,
      accessPoints: PUBLIC_LAB_ACCESS_POINTS,
      routes: PUBLIC_LAB_ROUTES,
    },
  })
}

export function validatePublishableRelease(input: MapReleaseDTO): string[] {
  const blockers = [...validateLabMapManifest()]
  if (!input.versionCode.trim()) blockers.push('กรุณาระบุรหัสเวอร์ชัน')
  if (!input.effectiveDate) blockers.push('กรุณาระบุวันที่มีผล')
  if (!input.reviewedBy) blockers.push('กรุณาระบุผู้ทบทวน')
  if (!input.approvedBy) blockers.push('กรุณาระบุผู้อนุมัติ')
  if (!input.approvedAt) blockers.push('กรุณาระบุเวลาที่อนุมัติ')
  if (input.reviewedBy && input.reviewedBy === input.approvedBy) blockers.push('ผู้ทบทวนและผู้อนุมัติต้องเป็นคนละคน')
  if (input.manifestHash !== currentManifestHash()) blockers.push('ฉบับร่างไม่ตรงกับผังในระบบปัจจุบัน')
  for (const station of LAB_STATIONS) {
    if (!LAB_ROUTE_PRESETS.some((route) => route.kind === 'evacuation' && route.fromStationCode === station.code)) {
      blockers.push(`ไม่มีเส้นทางหนีไฟที่อนุมัติสำหรับ ${station.nameTh}`)
    }
  }
  if (LAB_ROUTE_PRESETS.some((route) => route.pointCodes.includes('door-electrical-control'))) {
    blockers.push('เส้นทางมีประตูห้องควบคุมไฟฟ้าที่ล็อคถาวร')
  }
  return [...new Set(blockers)]
}

export function isOfficialRelease(input: MapReleaseDTO) {
  return input.status === 'published' && validatePublishableRelease(input).length === 0
}
