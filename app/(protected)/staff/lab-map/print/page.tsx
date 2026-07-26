import { redirect } from 'next/navigation'
import { LabMapExportClient } from '@/components/lab-map/LabMapExportClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LAB_MAP_VERSION, LAB_ROUTE_PRESETS, LAB_STATIONS } from '@/lib/lab-map/manifest'
import { VISITOR_STATION_CODE } from '@/lib/lab-map/visitor'
import { currentManifestHash } from '@/lib/lab-map/release'
import { mapReleaseRow } from '@/lib/lab-map/release-server'
import { buildMapPrintDTO, type MapPaperSize, type MapPrintDTO } from '@/lib/lab-map/print'
import type { MapReleaseDTO } from '@/lib/lab-map/types'

export const dynamic = 'force-dynamic'

export default async function LabMapPrintPage() {
  const actor = await getActor()
  if (!actor) redirect('/login')
  const { data: releaseRow } = await supabaseAdmin.from('lab_map_versions').select('*')
    .in('status', ['published', 'draft']).order('status', { ascending: false }).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const release: MapReleaseDTO = releaseRow ? mapReleaseRow(releaseRow) : {
    versionCode: LAB_MAP_VERSION, status: 'draft', manifestHash: currentManifestHash(),
    effectiveDate: null, reviewedBy: null, approvedBy: null, approvedAt: null,
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lab.chonburihospital.go.th').replace(/\/$/, '')
  const catalog: MapPrintDTO[] = []
  const papers: MapPaperSize[] = ['A3', 'A4']
  // สถานีชนิด 'checkpoint' คือจุดที่ผู้มาติดต่อยืนรอจริง ไม่ใช่จุดติดตั้งป้าย — ไม่เข้าแคตตาล็อกงานพิมพ์
  const installationStations = LAB_STATIONS.filter((station) => station.kind === 'installation')
  for (const paperSize of papers) for (const station of installationStations) {
    for (const kind of ['evacuation', 'infection_control'] as const) {
      const result = buildMapPrintDTO({ release, kind, paperSize, stationCode: station.code, webUrl: `${siteUrl}/staff/lab-map` })
      if (result.ok) catalog.push(result.value)
    }
  }
  // ไม่มีเส้นทางสาธารณะแบบ URL อีกต่อไป — QR ชี้กลับไปที่แผนที่ฝั่งเจ้าหน้าที่
  const destinations = [...new Set(LAB_ROUTE_PRESETS.filter((route) => route.kind === 'visitor' && route.fromStationCode === VISITOR_STATION_CODE).map((route) => route.destinationCode))]
  for (const paperSize of papers) for (const destinationCode of destinations) {
    const result = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize, stationCode: VISITOR_STATION_CODE, destinationCode, webUrl: `${siteUrl}/staff/lab-map` })
    if (result.ok) catalog.push(result.value)
  }
  return <><PageHeader title="ส่งออกแผนที่ควบคุม" subtitle="A3/A4 · PDF/PNG · แยกชั้นข้อมูลตามวัตถุประสงค์" /><LabMapExportClient catalog={catalog} /></>
}
