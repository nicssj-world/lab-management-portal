import { DEPARTMENTS } from '@/lib/validations/user-schema'
import {
  LAB_ACCESS_POINTS,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_STATIONS,
  LAB_ZONES,
  REQUIRED_SPACE_CODES,
  resolveRoutePreset,
} from './manifest'

export { resolveRoutePreset }

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

export function validateLabMapManifest(): string[] {
  const errors: string[] = []
  const spaceCodes = new Set(LAB_SPACES.map((space) => space.code))
  const zoneCodes = new Set(LAB_ZONES.map((zone) => zone.code))
  const accessPointCodes = new Set(LAB_ACCESS_POINTS.map((point) => point.code))
  const stationCodes = new Set(LAB_STATIONS.map((station) => station.code))
  const departmentNames = new Set<string>(DEPARTMENTS)

  for (const [label, values] of [
    ['space', LAB_SPACES.map((item) => item.code)],
    ['zone', LAB_ZONES.map((item) => item.code)],
    ['access point', LAB_ACCESS_POINTS.map((item) => item.code)],
    ['station', LAB_STATIONS.map((item) => item.code)],
    ['route', LAB_ROUTE_PRESETS.map((item) => item.code)],
  ] as const) {
    for (const duplicate of duplicateValues(values)) {
      errors.push(`Duplicate ${label} code: ${duplicate}`)
    }
  }

  for (const requiredCode of REQUIRED_SPACE_CODES) {
    if (!spaceCodes.has(requiredCode)) errors.push(`Missing required space: ${requiredCode}`)
  }

  for (const space of LAB_SPACES) {
    for (const workUnit of space.workUnits) {
      if (!departmentNames.has(workUnit)) {
        errors.push(`Unknown work unit ${workUnit} on space ${space.code}`)
      }
    }
  }

  for (const zone of LAB_ZONES) {
    for (const spaceCode of zone.spaceCodes) {
      if (!spaceCodes.has(spaceCode)) errors.push(`Zone ${zone.code} references missing space ${spaceCode}`)
    }
    for (const workUnit of zone.workUnits) {
      if (!departmentNames.has(workUnit)) {
        errors.push(`Unknown work unit ${workUnit} on zone ${zone.code}`)
      }
    }
  }

  for (const route of LAB_ROUTE_PRESETS) {
    if (!stationCodes.has(route.fromStationCode)) {
      errors.push(`Route ${route.code} references missing station ${route.fromStationCode}`)
    }
    if (!accessPointCodes.has(route.destinationCode)) {
      errors.push(`Route ${route.code} references missing destination ${route.destinationCode}`)
    }
    if (route.polyline.length < 2) errors.push(`Route ${route.code} must have at least two coordinates`)

    for (const pointCode of route.pointCodes) {
      const point = LAB_ACCESS_POINTS.find((candidate) => candidate.code === pointCode)
      if (!point) {
        errors.push(`Route ${route.code} references missing access point ${pointCode}`)
      } else if (point.status === 'permanently_locked') {
        errors.push(`Route ${route.code} passes permanently locked point ${pointCode}`)
      }
    }

    if (route.kind === 'visitor') {
      const destination = LAB_ACCESS_POINTS.find((point) => point.code === route.destinationCode)
      if (destination?.kind !== 'fingerprint' || destination.status !== 'fingerprint_controlled') {
        errors.push(`Visitor route ${route.code} must end at a fingerprint-controlled point`)
      }
    }
  }

  for (const station of LAB_STATIONS) {
    const hasPrimaryEvacuationRoute = LAB_ROUTE_PRESETS.some(
      (route) =>
        route.kind === 'evacuation' &&
        route.variant === 'primary' &&
        route.fromStationCode === station.code,
    )
    if (!hasPrimaryEvacuationRoute) {
      errors.push(`Station ${station.code} has no primary evacuation preset`)
    }
  }

  if (!zoneCodes.has('storage-zone')) errors.push('Missing storage-zone')

  return errors
}
