import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { LabMapShell } from '@/components/lab-map/LabMapShell'
import { getPublicLabMapDTO } from '@/lib/lab-map/public'

export const metadata: Metadata = {
  title: 'แผนที่ห้องปฏิบัติการ | กลุ่มงานเทคนิคการแพทย์',
  description: 'แผนที่นำทางไปยังจุดสแกนนิ้วมือและทางออก ชั้น 3 โรงพยาบาลชลบุรี',
}

interface PublicLabMapPageProps {
  params: Promise<{ stationCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PublicLabMapPage(
  props: PublicLabMapPageProps,
) {
  const { stationCode } = await props.params
  const searchParams = await props.searchParams
  const map = getPublicLabMapDTO(stationCode)
  if (!map) notFound()

  const requestedDestination = typeof searchParams.destination === 'string'
    ? searchParams.destination
    : null
  const activeRoute = requestedDestination
    ? map.routes.find(
        (route) => route.kind === 'visitor' && route.destinationCode === requestedDestination,
      ) ?? null
    : null
  const requestedMode = searchParams.mode === 'safety'
    ? 'safety'
    : activeRoute
      ? 'overview'
      : 'safety'

  return (
    <div className="public-lab-map-page">
      <style>{`
        .public-lab-map-page {
          background:
            linear-gradient(180deg, rgba(30,95,173,.08), transparent 260px),
            var(--bg);
          min-height: calc(100vh - 140px);
          padding: clamp(28px, 5vw, 64px) clamp(14px, 4vw, 48px) 70px;
        }
        .public-lab-map-page > .lab-map-shell {
          margin: 0 auto;
          max-width: 1440px;
        }
      `}</style>
      <LabMapShell
        map={map}
        allowedModes={['overview', 'safety']}
        initialMode={requestedMode}
        initialRouteCode={activeRoute?.code ?? null}
        heading="แผนที่นำทางห้องปฏิบัติการ"
        description="เลือกจุดหมายและเดินตามป้ายจริงภายในอาคาร เส้นทางบุคคลภายนอกสิ้นสุดที่จุดสแกนนิ้วมือ"
        eyebrow="แผนที่สำหรับผู้มาติดต่อ · ชั้น 3"
      />
    </div>
  )
}
