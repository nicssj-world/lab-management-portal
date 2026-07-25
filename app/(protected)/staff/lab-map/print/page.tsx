import { redirect } from 'next/navigation'
import { LabMapExportClient } from '@/components/lab-map/LabMapExportClient'
import { PageHeader } from '@/components/ui/PageHeader'
import { getActor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { LAB_MAP_VERSION, LAB_STATIONS } from '@/lib/lab-map/manifest'
import { PUBLIC_LAB_ROUTES } from '@/lib/lab-map/public-manifest'
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
  for (const paperSize of papers) for (const station of LAB_STATIONS) {
    for (const kind of ['evacuation', 'infection_control'] as const) {
      const result = buildMapPrintDTO({ release, kind, paperSize, stationCode: station.code, webUrl: `${siteUrl}/lab-map/${station.code}` })
      if (result.ok) catalog.push(result.value)
    }
  }
  const destinations = [...new Set(PUBLIC_LAB_ROUTES.filter((route) => route.kind === 'visitor' && route.fromStationCode === 'office').map((route) => route.destinationCode))]
  for (const paperSize of papers) for (const destinationCode of destinations) {
    const result = buildMapPrintDTO({ release, kind: 'visitor_navigation', paperSize, stationCode: 'office', destinationCode, webUrl: `${siteUrl}/lab-map/office?destination=${destinationCode}` })
    if (result.ok) catalog.push(result.value)
  }
  return <><PageHeader title="ส่งออกแผนที่ควบคุม" subtitle="A3/A4 · PDF/PNG · แยกชั้นข้อมูลตามวัตถุประสงค์" /><LabMapExportClient catalog={catalog} /></>
}
