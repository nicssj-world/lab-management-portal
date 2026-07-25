import {
  PUBLIC_LAB_ACCESS_POINTS,
  PUBLIC_LAB_MAP_VERSION,
  PUBLIC_LAB_ROUTES,
  PUBLIC_LAB_SPACES,
  PUBLIC_LAB_STATIONS,
  PUBLIC_LAB_VIEW_BOX,
  PUBLIC_LAB_ZONES,
} from './public-manifest'
import type { LabMapDTO } from './types'

export function getPublicLabMapDTO(stationCode: string): LabMapDTO | null {
  if (!PUBLIC_LAB_STATIONS.some((station) => station.code === stationCode)) return null

  return {
    version: PUBLIC_LAB_MAP_VERSION,
    viewBox: PUBLIC_LAB_VIEW_BOX,
    stationCode,
    spaces: PUBLIC_LAB_SPACES,
    zones: PUBLIC_LAB_ZONES,
    accessPoints: PUBLIC_LAB_ACCESS_POINTS,
    routes: PUBLIC_LAB_ROUTES.filter((route) => route.fromStationCode === stationCode),
  }
}
