import type { LabStructureDefinition, SvgShape } from './types'

export type Point = readonly [number, number]
export type Segment = readonly [Point, Point]
export interface Box { x: number; y: number; width: number; height: number }

export function boundingBox(shape: SvgShape): Box | null {
  if (shape.type === 'rect') return { x: shape.x, y: shape.y, width: shape.width, height: shape.height }
  if (shape.type === 'polygon' && shape.points.length > 0) {
    const xs = shape.points.map(([x]) => x)
    const ys = shape.points.map(([, y]) => y)
    const x = Math.min(...xs)
    const y = Math.min(...ys)
    return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
  }
  return null
}

/** a อยู่ภายใน b ทั้งหมดหรือไม่ — ใช้ตรวจห้องซ้อนห้อง */
export function boxContains(outer: Box, inner: Box, tolerance = 0.5) {
  return (
    inner.x >= outer.x - tolerance &&
    inner.y >= outer.y - tolerance &&
    inner.x + inner.width <= outer.x + outer.width + tolerance &&
    inner.y + inner.height <= outer.y + outer.height + tolerance
  )
}

export function boxContainsPoint(box: Box, [x, y]: Point, tolerance = 0) {
  return (
    x > box.x + tolerance &&
    x < box.x + box.width - tolerance &&
    y > box.y + tolerance &&
    y < box.y + box.height - tolerance
  )
}

export function sameBoxSize(a: Box, b: Box, tolerance = 0.5) {
  return Math.abs(a.width - b.width) <= tolerance && Math.abs(a.height - b.height) <= tolerance
}

/**
 * แปลง path ของแนวกั้นจุดสแกน (เขียนด้วย M/H/V/L แบบ absolute เท่านั้น)
 * ให้เป็นชุดเส้นตรง เพื่อตรวจว่าเส้นทางเยี่ยมชมตัดผ่านแนวกั้นหรือไม่
 */
export function pathSegments(d: string): Segment[] {
  const tokens = d.trim().split(/[\s,]+/)
  const segments: Segment[] = []
  let cursor: Point | null = null
  let index = 0
  const number = () => Number(tokens[index++])

  while (index < tokens.length) {
    const command = tokens[index++]
    switch (command) {
      case 'M': {
        cursor = [number(), number()]
        break
      }
      case 'L': {
        const next: Point = [number(), number()]
        if (cursor) segments.push([cursor, next])
        cursor = next
        break
      }
      case 'H': {
        if (!cursor) break
        const next: Point = [number(), cursor[1]]
        segments.push([cursor, next])
        cursor = next
        break
      }
      case 'V': {
        if (!cursor) break
        const next: Point = [cursor[0], number()]
        segments.push([cursor, next])
        cursor = next
        break
      }
      default:
        // คำสั่งอื่น (A/C/Z) ไม่ใช้กับแนวกั้น — ข้ามไปพร้อมตัวเลขที่ตามมา
        while (index < tokens.length && !Number.isNaN(Number(tokens[index]))) index++
        break
    }
  }
  return segments
}

function cross(ax: number, ay: number, bx: number, by: number) {
  return ax * by - ay * bx
}

/**
 * ตัดกันแบบ "ผ่านทะลุ" เท่านั้น — การแตะที่ปลายเส้นทาง (เช่น หยุดที่จุดสแกนบนแนวกั้น)
 * ไม่นับว่าตัดผ่าน เพราะเส้นทางผู้มาติดต่อต้องสิ้นสุดที่แนวกั้นพอดี
 */
export function segmentsProperlyCross(a: Segment, b: Segment, tolerance = 1e-9) {
  const [[ax1, ay1], [ax2, ay2]] = a
  const [[bx1, by1], [bx2, by2]] = b
  const rx = ax2 - ax1
  const ry = ay2 - ay1
  const sx = bx2 - bx1
  const sy = by2 - by1
  const denominator = cross(rx, ry, sx, sy)
  if (Math.abs(denominator) < tolerance) return false
  const t = cross(bx1 - ax1, by1 - ay1, sx, sy) / denominator
  const u = cross(bx1 - ax1, by1 - ay1, rx, ry) / denominator
  return t > tolerance && t < 1 - tolerance && u > -tolerance && u < 1 + tolerance
}

export function routeSegments(polyline: ReadonlyArray<Point>): Segment[] {
  const segments: Segment[] = []
  for (let index = 1; index < polyline.length; index += 1) {
    segments.push([polyline[index - 1], polyline[index]])
  }
  return segments
}

export function barrierSegments(structures: readonly LabStructureDefinition[]): Segment[] {
  return structures
    .filter((structure) => structure.kind === 'scanner-barrier')
    .flatMap((structure) => pathSegments(structure.d))
}

/** จุดตัดแนวกั้นของเส้นทาง โดยยอมให้ "ช่วงสุดท้าย" แตะแนวกั้นปลายทางได้ */
export function crossedBarriers(
  polyline: ReadonlyArray<Point>,
  barriers: readonly Segment[],
): number {
  return routeSegments(polyline).reduce(
    (total, segment) => total + barriers.filter((barrier) => segmentsProperlyCross(segment, barrier)).length,
    0,
  )
}

export function samePoint(a: Point, b: Point, tolerance = 0.5) {
  return Math.abs(a[0] - b[0]) <= tolerance && Math.abs(a[1] - b[1]) <= tolerance
}
