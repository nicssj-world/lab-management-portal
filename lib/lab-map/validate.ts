import { DEPARTMENTS } from '@/lib/validations/user-schema'
import {
  LAB_ACCESS_POINTS,
  LAB_LABELS,
  LAB_MAP_VIEW_BOX,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_STATIONS,
  LAB_STRUCTURES,
  LAB_ZONES,
  REQUIRED_SPACE_CODES,
  resolveRoutePreset,
  stationForCheckpoint,
} from './manifest'
import { EVACUATION_RESTRICTED_SPACE_CODES, LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import {
  barrierSegments,
  boundingBox,
  boxContains,
  boxContainsPoint,
  crossedBarriers,
  samePoint,
} from './geometry'
import { VISITOR_CHECKPOINT_BY_DEPARTMENT, VISITOR_STATION_CODE } from './visitor'

export { resolveRoutePreset }

/**
 * ข้อยกเว้นเดียวที่อนุมัติแล้ว (ยืนยันจากผู้ใช้): ประตูห้องประชุมไม่มีจุดสแกนนิ้วมือจริง แต่ได้รับ
 * อนุมัติให้เป็นปลายทางผู้มาติดต่อได้ (ไปพบหัวหน้ากลุ่มงานเทคนิคการแพทย์) โดยตั้งใจผ่อนกฎ
 * "เส้นทางผู้มาติดต่อต้องจบที่จุดสแกนนิ้วมือเสมอ" เฉพาะจุดนี้จุดเดียว
 * ห้ามเพิ่มปลายทางอื่นเข้าเซตนี้โดยไม่ทบทวนกฎความปลอดภัยข้อนี้ใหม่กับผู้รับผิดชอบก่อน
 */
const APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS = new Set(['door-meeting-room'])

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
  const spaceByCode = new Map(LAB_SPACES.map((space) => [space.code, space]))
  const zoneCodes = new Set(LAB_ZONES.map((zone) => zone.code))
  const pointByCode = new Map(LAB_ACCESS_POINTS.map((point) => [point.code, point]))
  const stationByCode = new Map(LAB_STATIONS.map((station) => [station.code, station]))
  const departmentNames = new Set<string>(DEPARTMENTS)

  for (const [labelName, values] of [
    ['space', LAB_SPACES.map((item) => item.code)],
    ['zone', LAB_ZONES.map((item) => item.code)],
    ['access point', LAB_ACCESS_POINTS.map((item) => item.code)],
    ['station', LAB_STATIONS.map((item) => item.code)],
    ['route', LAB_ROUTE_PRESETS.map((item) => item.code)],
    ['structure', LAB_STRUCTURES.map((item) => item.code)],
    ['label', LAB_LABELS.map((item) => item.code)],
  ] as const) {
    for (const duplicate of duplicateValues(values)) {
      errors.push(`Duplicate ${labelName} code: ${duplicate}`)
    }
  }

  for (const requiredCode of REQUIRED_SPACE_CODES) {
    if (!spaceByCode.has(requiredCode)) errors.push(`Missing required space: ${requiredCode}`)
  }

  // ── ห้องและป้ายชื่อ ──
  for (const space of LAB_SPACES) {
    for (const workUnit of space.workUnits) {
      if (!departmentNames.has(workUnit)) {
        errors.push(`Unknown work unit ${workUnit} on space ${space.code}`)
      }
    }
    if (!LAB_LABELS.some((item) => item.spaceCode === space.code)) {
      errors.push(`Space ${space.code} has no authored label`)
    }
    if (space.nestedIn) {
      const parent = spaceByCode.get(space.nestedIn)
      if (!parent) {
        errors.push(`Space ${space.code} nests in missing space ${space.nestedIn}`)
      } else {
        const parentBox = boundingBox(parent.shape)
        const childBox = boundingBox(space.shape)
        if (!parentBox || !childBox || !boxContains(parentBox, childBox)) {
          errors.push(`Space ${space.code} is not fully inside ${space.nestedIn}`)
        }
        if (LAB_SPACES.indexOf(parent) > LAB_SPACES.indexOf(space)) {
          errors.push(`Nested space ${space.code} must be listed after ${space.nestedIn}`)
        }
      }
    }
  }

  for (const item of LAB_LABELS) {
    if (item.lines.length === 0 || item.lines.some((line) => line.trim() === '')) {
      errors.push(`Label ${item.code} has an empty line`)
    }
    if (item.spaceCode && !spaceByCode.has(item.spaceCode)) {
      errors.push(`Label ${item.code} references missing space ${item.spaceCode}`)
    }
  }

  for (const zone of LAB_ZONES) {
    for (const spaceCode of zone.spaceCodes) {
      if (!spaceByCode.has(spaceCode)) errors.push(`Zone ${zone.code} references missing space ${spaceCode}`)
    }
    for (const workUnit of zone.workUnits) {
      if (!departmentNames.has(workUnit)) {
        errors.push(`Unknown work unit ${workUnit} on zone ${zone.code}`)
      }
    }
  }

  // ── เส้นทาง ──
  const barriers = barrierSegments(LAB_STRUCTURES)
  const controlledBoxes = LAB_SPACES
    .filter((space) => space.controlled)
    .map((space) => ({ code: space.code, box: boundingBox(space.shape) }))

  for (const preset of LAB_ROUTE_PRESETS) {
    const station = stationByCode.get(preset.fromStationCode)
    const destination = pointByCode.get(preset.destinationCode)
    if (!station) errors.push(`Route ${preset.code} references missing station ${preset.fromStationCode}`)
    if (!destination) errors.push(`Route ${preset.code} references missing destination ${preset.destinationCode}`)
    if (preset.polyline.length < 2) {
      errors.push(`Route ${preset.code} must have at least two coordinates`)
      continue
    }
    if (preset.directionsTh.length === 0) errors.push(`Route ${preset.code} has no Thai directions`)

    if (station && !samePoint(preset.polyline[0], [station.x, station.y])) {
      errors.push(`Route ${preset.code} must start at station ${preset.fromStationCode}`)
    }
    if (destination) {
      const last = preset.polyline[preset.polyline.length - 1]
      if (!samePoint(last, [destination.x, destination.y])) {
        errors.push(`Route ${preset.code} must end exactly at ${preset.destinationCode}`)
      }
    }

    for (const pointCode of preset.pointCodes) {
      const point = pointByCode.get(pointCode)
      if (!point) {
        errors.push(`Route ${preset.code} references missing access point ${pointCode}`)
      } else if (point.status === 'permanently_locked') {
        errors.push(`Route ${preset.code} passes permanently locked point ${pointCode}`)
      }
    }

    if (preset.kind === 'visitor') {
      const isApprovedException = APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS.has(preset.destinationCode)
      if (!isApprovedException && destination
        && (destination.kind !== 'fingerprint' || destination.status !== 'fingerprint_controlled')) {
        errors.push(`Visitor route ${preset.code} must end at a fingerprint-controlled point`)
      }
      if (isApprovedException && destination?.status === 'permanently_locked') {
        errors.push(`Visitor route ${preset.code} ends at a permanently locked door`)
      }
      if (crossedBarriers(preset.polyline, barriers) > 0) {
        errors.push(`Visitor route ${preset.code} crosses a scanner-control barrier`)
      }
      // จุดสุดท้ายคือจุดสแกนซึ่งอยู่บนผนัง/แนวกั้นของพื้นที่ควบคุมเสมอ จึงไม่นับ
      // และเผื่อระยะ 2 หน่วยเพื่อไม่ให้จุดที่แนบผนังถูกตีความว่าเข้าไปในห้อง
      for (const point of preset.polyline.slice(0, -1)) {
        for (const controlled of controlledBoxes) {
          if (controlled.box && boxContainsPoint(controlled.box, point, 2)) {
            errors.push(`Visitor route ${preset.code} enters controlled space ${controlled.code}`)
          }
        }
      }
    }
  }

  // ── ทางหนีไฟ ──
  for (const station of LAB_STATIONS) {
    for (const variant of ['primary', 'alternate'] as const) {
      const hasPreset = LAB_ROUTE_PRESETS.some(
        (preset) =>
          preset.kind === 'evacuation' &&
          preset.variant === variant &&
          preset.fromStationCode === station.code,
      )
      if (!hasPreset) errors.push(`Station ${station.code} has no ${variant} evacuation preset`)
    }
  }

  // ── สถานีชนิด 'checkpoint' ต้องวางทับพิกัดจุดสแกนที่ผูกไว้เป๊ะ ๆ ──
  // (สถานีชนิด 'installation' ไม่บังคับ — 'office' มี checkpointCode เพื่อความสะดวก
  // แต่พิกัดจุดติดตั้งป้ายไม่จำเป็นต้องตรงกับจุดสแกนเป๊ะเหมือนเดิม)
  for (const station of LAB_STATIONS) {
    if (station.kind !== 'checkpoint' || !station.checkpointCode) continue
    const point = pointByCode.get(station.checkpointCode)
    if (!point) {
      errors.push(`Station ${station.code} references missing checkpoint ${station.checkpointCode}`)
    } else if (!samePoint([station.x, station.y], [point.x, point.y])) {
      errors.push(`Checkpoint station ${station.code} is not on its checkpoint coordinate`)
    }
  }

  // ── การจับคู่หน่วยงานกับจุดสแกน ──
  for (const [department, checkpointCode] of Object.entries(VISITOR_CHECKPOINT_BY_DEPARTMENT)) {
    if (!checkpointCode) continue
    const point = pointByCode.get(checkpointCode)
    const isApprovedException = APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS.has(checkpointCode)
    if (!point || (!isApprovedException && point.kind !== 'fingerprint')) {
      errors.push(`Department ${department} maps to missing checkpoint ${checkpointCode}`)
      continue
    }
    const hasRoute = LAB_ROUTE_PRESETS.some(
      (preset) =>
        preset.kind === 'visitor' &&
        preset.fromStationCode === VISITOR_STATION_CODE &&
        preset.destinationCode === checkpointCode,
    )
    if (!hasRoute) errors.push(`Department ${department} has no approved visitor route to ${checkpointCode}`)

    // ทุกจุดสแกนปลายทางของผู้มาติดต่อต้องมีสถานีความปลอดภัยรองรับ ไม่ตกไปที่ 'office' เงียบ ๆ
    if (checkpointCode !== 'fingerprint-office' && stationForCheckpoint(checkpointCode) === 'office') {
      errors.push(`Checkpoint ${checkpointCode} for department ${department} has no dedicated safety station`)
    }
  }

  // ── ลิฟต์ที่ห้ามใช้ขณะเกิดเหตุ ต้องอ้างรหัสห้องที่มีอยู่จริง ──
  for (const code of EVACUATION_RESTRICTED_SPACE_CODES) {
    if (!spaceByCode.has(code)) errors.push(`Evacuation-restricted space ${code} does not exist`)
  }

  // ── อุปกรณ์ความปลอดภัย ──
  const [, , viewWidth, viewHeight] = LAB_MAP_VIEW_BOX.split(' ').map(Number)
  for (const duplicate of duplicateValues(LAB_SAFETY_EQUIPMENT.map((item) => item.code))) {
    errors.push(`Duplicate safety equipment code: ${duplicate}`)
  }
  for (const item of LAB_SAFETY_EQUIPMENT) {
    if (item.x < 0 || item.x > viewWidth || item.y < 0 || item.y > viewHeight) {
      errors.push(`Safety equipment ${item.code} is outside the map view box`)
    }
  }

  // ── จุดรวมพลต้องครอบคลุมทุกทางออกที่มีอยู่ ──
  const exitCodes = LAB_ACCESS_POINTS.filter((point) => point.kind === 'exit').map((point) => point.code)
  const assembledExitCodes = new Set(LAB_ASSEMBLY_POINTS.flatMap((assembly) => assembly.exitCodes))
  for (const exitCode of exitCodes) {
    if (!assembledExitCodes.has(exitCode)) errors.push(`Exit ${exitCode} has no assigned assembly point`)
  }

  if (!zoneCodes.has('storage-zone')) errors.push('Missing storage-zone')

  return errors
}
