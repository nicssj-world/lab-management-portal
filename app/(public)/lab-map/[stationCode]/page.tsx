import { notFound } from 'next/navigation'
import { LabMapShell } from '@/components/lab-map/LabMapShell'
import { buildPublicSafetyMap } from '@/lib/lab-map/public-safety'
import { getPublishedLabMapSnapshot } from '@/lib/lab-map/server'

export const dynamic = 'force-dynamic'

export default async function PublicLabMapPage({ params }: { params: Promise<{ stationCode: string }> }) {
  const { stationCode } = await params
  const published = await getPublishedLabMapSnapshot()
  if (!published) {
    return (
      <main className="public-lab-map-page">
        <style>{`.public-lab-map-page{max-width:760px;margin:0 auto;padding:48px 24px 64px}.public-lab-map-notice{padding:28px;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--public-shadow-sm)}.public-lab-map-notice h1{margin:0;color:var(--ink);font-size:24px}.public-lab-map-notice p{margin:10px 0 0;color:var(--muted);line-height:1.7}`}</style>
        <section className="public-lab-map-notice" role="status">
          <h1>ยังไม่มีฉบับเผยแพร่</h1>
          <p>แผนที่ออนไลน์กำลังรอการอนุมัติเผยแพร่ โปรดปฏิบัติตามป้ายฉบับที่ติดตั้งในพื้นที่และคำสั่งเจ้าหน้าที่</p>
        </section>
      </main>
    )
  }

  const map = buildPublicSafetyMap({
    stationCode,
    version: published.versionCode,
    assemblyPoints: published.assemblyPoints,
  })
  if (!map) notFound()

  return (
    <main className="public-lab-map-page">
      <style>{`.public-lab-map-page{max-width:1440px;margin:0 auto;padding:28px 24px 56px}@media(max-width:767px){.public-lab-map-page{padding:18px 12px 40px}}`}</style>
      <LabMapShell
        map={map}
        allowedModes={['safety']}
        initialMode="safety"
        initialSafetyStationCode={stationCode}
        safetyStationCodes={[stationCode]}
        heading="แผนที่ความปลอดภัยและทางออกฉุกเฉิน"
        description="ข้อมูลประกอบป้าย ณ จุดติดตั้งนี้ — เมื่อเกิดเหตุ ให้ปฏิบัติตามป้ายฉบับอนุมัติและคำสั่งเจ้าหน้าที่"
        eyebrow="กลุ่มงานเทคนิคการแพทย์ · ชั้น 3"
      />
    </main>
  )
}
