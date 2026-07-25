import {
  LAB_ACCESS_POINTS, LAB_MAP_VIEW_BOX, LAB_ROUTE_PRESETS, LAB_SPACES, LAB_STATIONS, LAB_ZONES,
} from './manifest'
import { getPublicLabMapDTO } from './public'
import { isOfficialRelease } from './release'
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

export type MapPrintResult = { ok: true; value: MapPrintDTO } | { ok: false; error: 'missing_evacuation_preset' | 'unknown_station' | 'unknown_visitor_destination' }

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
  const official = isOfficialRelease(input.release)
  const common = {
    kind: input.kind, paperSize: input.paperSize, release: input.release,
    printedAt: input.printedAt ?? new Date().toISOString(), webUrl: input.webUrl,
    official, watermark: official ? null : 'ร่าง — ห้ามใช้ติดตั้ง',
    installationPoint: station.nameTh,
  }

  if (input.kind === 'visitor_navigation') {
    const publicMap = getPublicLabMapDTO(input.stationCode)
    if (!publicMap) return { ok: false, error: 'unknown_station' }
    const routes = publicMap.routes.filter((route) => route.kind === 'visitor'
      && (!input.destinationCode || route.destinationCode === input.destinationCode))
    if (input.destinationCode && routes.length === 0) return { ok: false, error: 'unknown_visitor_destination' }
    return { ok: true, value: {
      ...common, titleTh: 'แผนที่นำทางสำหรับผู้มาติดต่อ', mode: 'overview',
      map: { ...publicMap, routes }, activeRouteCodes: routes.map((route) => route.code),
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
    spaces: input.kind === 'infection_control' ? LAB_SPACES : LAB_SPACES.map(({ infectionClass: _class, ...space }) => space),
    zones: LAB_ZONES,
    accessPoints: input.kind === 'evacuation'
      ? LAB_ACCESS_POINTS.filter((point) => point.kind === 'exit' || point.status === 'permanently_locked' || point.code === 'fingerprint-office')
      : LAB_ACCESS_POINTS.filter((point) => point.code === 'fingerprint-office' || point.code === 'door-electrical-control'),
    routes,
  }
  return { ok: true, value: {
    ...common,
    titleTh: input.kind === 'evacuation' ? 'แผนผังเส้นทางหนีไฟ' : 'แผนผังพื้นที่ติดเชื้อ พื้นที่สะอาด และพื้นที่เสี่ยง',
    mode: input.kind === 'evacuation' ? 'safety' : 'infection',
    map,
    activeRouteCodes: routes.map((route) => route.code),
  } }
}
