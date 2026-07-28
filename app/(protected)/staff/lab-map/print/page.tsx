import { redirect } from 'next/navigation'
import { LabMapExportClient } from '@/components/lab-map/LabMapExportClient'
import { LabMapReleasePanel } from '@/components/lab-map/LabMapReleasePanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LAB_MAP_VERSION, LAB_ROUTE_PRESETS, LAB_STATIONS } from '@/lib/lab-map/manifest'
import { VISITOR_STATION_CODE } from '@/lib/lab-map/visitor'
import { currentManifestHash, pickReleaseRows } from '@/lib/lab-map/release'
import { canManageMapReleases, mapReleaseRow } from '@/lib/lab-map/release-server'
import { buildMapPrintDTO, type MapPaperSize, type MapPrintDTO } from '@/lib/lab-map/print'
import { publicSafetyMapPath } from '@/lib/lab-map/public-safety'
import type { MapReleaseDTO } from '@/lib/lab-map/types'

export const dynamic = 'force-dynamic'

function fallbackRelease(): MapReleaseDTO {
  return {
    versionCode: LAB_MAP_VERSION, status: 'draft', manifestHash: currentManifestHash(),
    effectiveDate: null, reviewedBy: null, approvedBy: null, approvedAt: null,
  }
}

async function withReviewerNames(release: MapReleaseDTO): Promise<MapReleaseDTO> {
  const ids = [release.reviewedBy, release.approvedBy].filter((id): id is string => Boolean(id))
  if (ids.length === 0) return release
  const { data: people } = await supabaseAdmin.from('profiles').select('id, name').in('id', ids)
  const nameById = new Map((people ?? []).map((person) => [person.id as string, person.name as string | null]))
  return {
    ...release,
    reviewerName: release.reviewedBy ? (nameById.get(release.reviewedBy) ?? null) : null,
    approverName: release.approvedBy ? (nameById.get(release.approvedBy) ?? null) : null,
  }
}

export default async function LabMapPrintPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')
  const canManage = canManageMapReleases(actor)

  const { data: releaseRows } = await supabaseAdmin.from('lab_map_versions').select('*')
    .in('status', ['published', 'draft']).order('created_at', { ascending: false }).limit(20)
  const { printRow, managedRow } = pickReleaseRows(releaseRows ?? [])

  const release: MapReleaseDTO = await withReviewerNames(printRow ? mapReleaseRow(printRow) : fallbackRelease())
  const managedRelease: MapReleaseDTO = managedRow === printRow
    ? release
    : await withReviewerNames(managedRow ? mapReleaseRow(managedRow) : fallbackRelease())

  const staffRows = canManage
    ? await supabaseAdmin.from('profiles').select('id, name, role').eq('status', 'active').is('deleted_at', null).order('name')
    : { data: [] as { id: string; name: string | null; role: string }[] }
  const staff = (staffRows.data ?? []).map((row) => ({ id: String(row.id), name: row.name as string | null, role: String(row.role) }))

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab-management-cbh.vercel.app').replace(/\/$/, '')
  const catalog: MapPrintDTO[] = []
  const papers: MapPaperSize[] = ['A3', 'A4']
  // สถานีชนิด 'checkpoint' คือจุดที่ผู้มาติดต่อยืนรอจริง ไม่ใช่จุดติดตั้งป้าย — ไม่เข้าแคตตาล็อกงานพิมพ์
  const installationStations = LAB_STATIONS.filter((station) => station.kind === 'installation')
  for (const paperSize of papers) for (const station of installationStations) {
    const publicPath = publicSafetyMapPath(station.code)
    if (!publicPath) continue
    for (const kind of ['evacuation', 'infection_control'] as const) {
      const result = buildMapPrintDTO({ release, kind, paperSize, stationCode: station.code, webUrl: `${siteUrl}${publicPath}` })
      if (result.ok) catalog.push(result.value)
    }
  }
  // QR ของป้ายทุกชนิดชี้ไปแผนที่ความปลอดภัย public ของจุดติดตั้งนั้น
  // หน้านี้ไม่มีผังห้อง/ข้อมูลควบคุมการติดเชื้อ จึงสแกนได้โดยไม่ต้องล็อกอินอย่างปลอดภัย
  // ไม่รวมจุดสแกนของสำนักงานเอง (checkpoint ของ VISITOR_STATION_CODE) เป็นตัวเลือกปลายทางที่พิมพ์ได้ —
  // ผู้มาติดต่อยืนอยู่หน้าสำนักงานอยู่แล้ว เส้นทางไปจุดสแกนที่ติดกับประตูเดียวกันไม่จำเป็นต้องมีป้ายพิมพ์แยก
  // (เส้นทางนี้ยังคงอยู่ใน manifest เพื่อใช้กับการนำทางในแอปสำหรับผู้มาติดต่อของแผนกนี้)
  const ownCheckpointCode = LAB_STATIONS.find((station) => station.code === VISITOR_STATION_CODE)?.checkpointCode
  const destinations = [...new Set(LAB_ROUTE_PRESETS.filter((route) => route.kind === 'visitor' && route.fromStationCode === VISITOR_STATION_CODE && route.destinationCode !== ownCheckpointCode).map((route) => route.destinationCode))]
  const visitorMapPath = publicSafetyMapPath(VISITOR_STATION_CODE)
  for (const paperSize of papers) for (const destinationCode of destinations) {
    if (!visitorMapPath) continue
    const result = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize, stationCode: VISITOR_STATION_CODE, destinationCode, webUrl: `${siteUrl}${visitorMapPath}` })
    if (result.ok) catalog.push(result.value)
  }

  return <>
    <PageHeader title="ส่งออกแผนที่ควบคุม" subtitle="A3/A4 · PDF/PNG · แยกชั้นข้อมูลตามวัตถุประสงค์" />
    {canManage ? <LabMapReleasePanel key={managedRelease.id ?? 'new'} release={managedRelease} staff={staff} /> : null}
    <LabMapExportClient catalog={catalog} />
  </>
}
