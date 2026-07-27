import { EQUIPMENT_AREAS, EQUIPMENT_DOORS, EQUIPMENT_MAP_VIEW_BOX, EQUIPMENT_WALLS } from './manifest'
import type { EquipmentAreaDefinition, EquipmentPoint, EquipmentRect } from './types'

function duplicateValues(values: readonly string[]): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value)
    seen.add(value)
  }
  return [...duplicates]
}

const contains = (outer: EquipmentRect, inner: EquipmentRect, tolerance = 1) =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance

const overlaps = (a: EquipmentRect, b: EquipmentRect) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const polygonArea = (points: readonly EquipmentPoint[]) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length]
  return sum + point.x * next.y - next.x * point.y
}, 0)) / 2

const areaSize = (area: EquipmentAreaDefinition) =>
  area.polygon ? polygonArea(area.polygon) : area.rect.width * area.rect.height

export function validateEquipmentMap(): string[] {
  const errors: string[] = []
  const areaByCode = new Map(EQUIPMENT_AREAS.map((area) => [area.code, area]))
  const [, , viewWidth, viewHeight] = EQUIPMENT_MAP_VIEW_BOX.split(' ').map(Number)

  for (const duplicate of duplicateValues(EQUIPMENT_AREAS.map((area) => area.code))) {
    errors.push(`Duplicate equipment area code: ${duplicate}`)
  }
  for (const duplicate of duplicateValues(EQUIPMENT_WALLS.map((item) => item.code))) {
    errors.push(`Duplicate wall code: ${duplicate}`)
  }
  for (const duplicate of duplicateValues(EQUIPMENT_DOORS.map((item) => item.code))) {
    errors.push(`Duplicate door code: ${duplicate}`)
  }

  for (const area of EQUIPMENT_AREAS) {
    const { rect, label } = area

    // ── kind / parentCode ──
    if (area.kind === 'room' && area.parentCode) {
      errors.push(`Room ${area.code} must not have a parentCode`)
    }
    if (area.kind === 'zone') {
      if (!area.parentCode) {
        errors.push(`Zone ${area.code} must have a parentCode`)
      } else {
        const parent = areaByCode.get(area.parentCode)
        if (!parent) errors.push(`Zone ${area.code} references missing parent ${area.parentCode}`)
        else if (parent.kind !== 'room') errors.push(`Zone ${area.code} parent ${area.parentCode} must be kind "room"`)
        else if (!contains(parent.rect, rect)) errors.push(`Zone ${area.code} is not fully inside parent ${area.parentCode}`)
      }
    }

    // ── อยู่ในกรอบผัง ──
    if (rect.width <= 0 || rect.height <= 0) errors.push(`Area ${area.code} has a non-positive size`)
    if (rect.x < 0 || rect.y < 0 || rect.x + rect.width > viewWidth || rect.y + rect.height > viewHeight) {
      errors.push(`Area ${area.code} is outside the map view box`)
    }
    if (area.polygon && area.polygon.some((point) => !contains(rect, { x: point.x, y: point.y, width: 0, height: 0 }))) {
      errors.push(`Polygon for area ${area.code} falls outside its bounding rect`)
    }

    // ── ป้ายชื่อ (ถ้ามี) ต้องอยู่ในกรอบพื้นที่ของตัวเอง ──
    if (label) {
      if (label.x < rect.x || label.x > rect.x + rect.width || label.y < rect.y || label.y > rect.y + rect.height) {
        errors.push(`Label for area ${area.code} falls outside its own shape`)
      }
      if (label.lines.length === 0 || label.lines.some((line) => line.trim() === '')) {
        errors.push(`Label for area ${area.code} has an empty line`)
      }
    }
  }

  // ── ห้องต้องไม่ทับกันเอง (โซนทับห้องแม่ได้ตามนิยาม) ──
  const rooms = EQUIPMENT_AREAS.filter((area) => area.kind === 'room')
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      if (!rooms[i].polygon && !rooms[j].polygon && overlaps(rooms[i].rect, rooms[j].rect)) {
        errors.push(`Rooms ${rooms[i].code} and ${rooms[j].code} overlap`)
      }
    }
  }

  // ── โซนลูกของห้องเดียวกันต้องปูเต็มห้องแม่พอดี ไม่เหลือช่องว่าง ไม่ทับกัน ──
  const zonesByParent = new Map<string, EquipmentAreaDefinition[]>()
  for (const area of EQUIPMENT_AREAS) {
    if (area.kind !== 'zone' || !area.parentCode) continue
    const list = zonesByParent.get(area.parentCode) ?? []
    list.push(area)
    zonesByParent.set(area.parentCode, list)
  }
  for (const [parentCode, zones] of zonesByParent) {
    const parent = areaByCode.get(parentCode)
    if (!parent) continue
    const parentArea = areaSize(parent)
    const zoneArea = zones.reduce((total, zone) => total + areaSize(zone), 0)
    if (Math.abs(parentArea - zoneArea) > 1) {
      errors.push(`Zones of room ${parentCode} do not sum exactly to its area (parent=${parentArea}, zones=${zoneArea})`)
    }
    for (let i = 0; i < zones.length; i += 1) {
      for (let j = i + 1; j < zones.length; j += 1) {
        if (!zones[i].polygon && !zones[j].polygon && overlaps(zones[i].rect, zones[j].rect)) {
          errors.push(`Zones ${zones[i].code} and ${zones[j].code} overlap inside ${parentCode}`)
        }
      }
    }
  }

  return errors
}
