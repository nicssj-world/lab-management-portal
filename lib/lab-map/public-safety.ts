import {
  LAB_ACCESS_POINTS,
  LAB_MAP_VIEW_BOX,
  LAB_ROUTE_PRESETS,
  LAB_STATIONS,
  LAB_STRUCTURES,
} from './manifest'
import { LAB_ASSEMBLY_POINTS } from './safety-assets'
import type { LabAssemblyPointDefinition, LabMapDTO } from './types'

/**
 * URL ถาวรของ QR บนป้าย: ระบุได้เฉพาะจุดติดตั้งป้ายจริง ไม่รับจุดสแกนหรือค่าอื่น
 * เพื่อให้พิมพ์ป้ายครั้งเดียว แต่หน้าเว็บแสดงฉบับเผยแพร่ล่าสุดของจุดนั้นได้เสมอ
 */
export function publicSafetyMapPath(stationCode: string): string | null {
  const station = LAB_STATIONS.find((item) => item.code === stationCode && item.kind === 'installation')
  return station ? `/lab-map/${station.code}` : null
}

/**
 * Projection สำหรับ QR สาธารณะ: เหลือแค่ขอบอาคาร จุดที่ยืน ทางออก เส้นทางหนีไฟ และจุดรวมพล
 * จงใจไม่ส่งผังห้อง ป้ายชื่อห้อง ประตูภายใน โซน หรืออุปกรณ์ เพื่อไม่เผย topology ของแล็บ
 * แม้ผู้ใช้จะเปิด RSC payload หรือ JavaScript ในเบราว์เซอร์โดยตรง
 */
export function buildPublicSafetyMap(input: {
  stationCode: string
  version: string
  assemblyPoints?: readonly LabAssemblyPointDefinition[]
}): LabMapDTO | null {
  const station = LAB_STATIONS.find((item) => item.code === input.stationCode && item.kind === 'installation')
  if (!station) return null

  return {
    version: input.version,
    releaseStatus: 'published',
    viewBox: LAB_MAP_VIEW_BOX,
    stationCode: station.code,
    structures: LAB_STRUCTURES.filter((item) => item.kind === 'exterior-wall'),
    spaces: [],
    labels: [],
    zones: [],
    accessPoints: LAB_ACCESS_POINTS.filter((item) => item.kind === 'exit'),
    stations: [station],
    routes: LAB_ROUTE_PRESETS.filter((item) => item.kind === 'evacuation' && item.fromStationCode === station.code),
    safetyEquipment: [],
    assemblyPoints: input.assemblyPoints ?? LAB_ASSEMBLY_POINTS,
  }
}
