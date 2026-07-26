import {
  LAB_ACCESS_POINTS, LAB_LABELS, LAB_MAP_VIEW_BOX, LAB_ROUTE_PRESETS, LAB_SPACES,
  LAB_STATIONS, LAB_STRUCTURES, LAB_ZONES,
} from './manifest'
import { LAB_ASSEMBLY_POINTS, LAB_SAFETY_EQUIPMENT } from './safety-assets'
import { isOfficialRelease } from './release'
import { VISITOR_STATION_CODE, buildVisitorLabMapDTO } from './visitor'
import type { LabMapDTO, MapMode, MapReleaseDTO } from './types'

export type MapPrintKind = 'evacuation' | 'infection_control' | 'visitor_navigation'
export type MapPaperSize = 'A3' | 'A4'

export interface MapPrintDTO {
  kind: MapPrintKind
  paperSize: MapPaperSize
  titleTh: string
  installationPoint: string
  mode: MapMode
  map: LabMapDTO
  release: MapReleaseDTO
  printedAt: string
  webUrl: string
  official: boolean
  watermark: string | null
  activeRouteCodes: readonly string[]
}

export type MapPrintResult =
  | { ok: true; value: MapPrintDTO }
  | { ok: false; error: 'missing_evacuation_preset' | 'unknown_station' | 'unknown_visitor_destination' }

export function buildMapPrintDTO(input: {
  release: MapReleaseDTO
  kind: MapPrintKind
  paperSize: MapPaperSize
  stationCode: string
  destinationCode?: string | null
  webUrl: string
  printedAt?: string
}): MapPrintResult {
  const station = LAB_STATIONS.find((item) => item.code === input.stationCode)
  if (!station) return { ok: false, error: input.kind === 'evacuation' ? 'missing_evacuation_preset' : 'unknown_station' }
  // สถานีชนิด 'checkpoint' เป็นจุดที่ผู้มาติดต่อยืนจริง ไม่ใช่จุดติดตั้งป้าย จึงไม่พิมพ์เป็นแผ่นแยก
  if (input.kind !== 'visitor_navigation' && station.kind !== 'installation') {
    return { ok: false, error: 'unknown_station' }
  }
  const official = isOfficialRelease(input.release)
  const common = {
    kind: input.kind, paperSize: input.paperSize, release: input.release,
    printedAt: input.printedAt ?? new Date().toISOString(), webUrl: input.webUrl,
    official, watermark: official ? null : 'ร่าง — ห้ามใช้ติดตั้ง',
    installationPoint: station.nameTh,
  }

  if (input.kind === 'visitor_navigation') {
    if (input.stationCode !== VISITOR_STATION_CODE) return { ok: false, error: 'unknown_station' }
    const visitorMap = buildVisitorLabMapDTO()
    const routes = visitorMap.routes.filter((route) => route.kind === 'visitor'
      && (!input.destinationCode || route.destinationCode === input.destinationCode))
    if (input.destinationCode && routes.length === 0) return { ok: false, error: 'unknown_visitor_destination' }
    return { ok: true, value: {
      ...common, titleTh: 'แผนที่นำทางสำหรับผู้มาติดต่อ', mode: 'overview',
      map: { ...visitorMap, routes }, activeRouteCodes: routes.map((route) => route.code),
    } }
  }

  const routes = input.kind === 'evacuation'
    ? LAB_ROUTE_PRESETS.filter((route) => route.kind === 'evacuation' && route.fromStationCode === input.stationCode)
    : []
  if (input.kind === 'evacuation' && routes.length === 0) return { ok: false, error: 'missing_evacuation_preset' }
  const map: LabMapDTO = {
    version: input.release.versionCode,
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: input.stationCode,
    structures: LAB_STRUCTURES,
    spaces: input.kind === 'infection_control' ? LAB_SPACES : LAB_SPACES.map(({ infectionClass: _class, ...space }) => space),
    labels: LAB_LABELS,
    zones: LAB_ZONES,
    // ป้ายเลข/ชื่อประตูหนีไฟ (LAB_LABELS) แสดงทุกชนิดแผ่นอยู่แล้ว — สัญลักษณ์ทางออกต้องมาคู่กันเสมอ
    // ไม่งั้นแผ่นควบคุมการติดเชื้อจะเห็นแค่เลข "3A" ลอยๆ โดยไม่มีไอคอนประตู
    accessPoints: LAB_ACCESS_POINTS.filter((point) => point.kind === 'exit' || point.status === 'permanently_locked'),
    stations: LAB_STATIONS.filter((item) => item.code === input.stationCode),
    routes,
    // ถังดับเพลิงและจุดรวมพลมีความหมายเฉพาะแผ่นเส้นทางหนีไฟ — แผ่นควบคุมการติดเชื้อไม่ต้องมี
    safetyEquipment: input.kind === 'evacuation' ? (input.release.assetSnapshot ?? LAB_SAFETY_EQUIPMENT) : [],
    assemblyPoints: input.kind === 'evacuation' ? (input.release.assemblyPointSnapshot ?? LAB_ASSEMBLY_POINTS) : [],
  }
  return { ok: true, value: {
    ...common,
    titleTh: input.kind === 'evacuation' ? 'แผนผังเส้นทางหนีไฟ' : 'แผนผังพื้นที่ติดเชื้อ พื้นที่สะอาด และพื้นที่เสี่ยง',
    mode: input.kind === 'evacuation' ? 'safety' : 'infection',
    map,
    activeRouteCodes: routes.map((route) => route.code),
  } }
}
