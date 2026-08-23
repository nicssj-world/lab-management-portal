import { notFound } from 'next/navigation'
import { LabMapShell } from '@/components/lab-map/LabMapShell'
import { buildPublicSafetyMap } from '@/lib/lab-map/public-safety'
import { getPublishedEvacuationGuidance } from '@/lib/lab-map/evacuation-server'
import { getPublishedLabMapSnapshot } from '@/lib/lab-map/server'

export const dynamic = 'force-dynamic'

export default async function PublicLabMapPage({ params }: { params: Promise<{ stationCode: string }> }) {
  const { stationCode } = await params
  const [published, guidance] = await Promise.all([
    getPublishedLabMapSnapshot(),
    getPublishedEvacuationGuidance(),
  ])
  if (!published) {
    return (
      <main className="public-lab-map-page">
        <style>{`.public-lab-map-page{max-width:760px;margin:0 auto;padding:48px 24px 64px}.public-lab-map-notice{padding:28px;background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--public-shadow-sm)}.public-lab-map-notice h1{margin:0;color:var(--ink);font-size:24px}.public-lab-map-notice p{margin:10px 0 0;color:var(--muted);line-height:1.7}`}</style>
        <section className="public-lab-map-notice" role="status">
          <h1>ขณะนี้ยังไม่มีแผนที่ออนไลน์ฉบับใช้งาน</h1>
          <p>โปรดดูป้ายแผนที่ที่ติดตั้ง ณ จุดนี้ หรือสอบถามเจ้าหน้าที่</p>
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

  const stationAssignments = guidance?.assignments.filter(assignment => assignment.scopeCode === stationCode) ?? []

  return (
    <main className="public-lab-map-page">
      <style>{`.public-lab-map-page{max-width:1440px;margin:0 auto;padding:28px 24px 56px}@media(max-width:767px){.public-lab-map-page{padding:18px 12px 40px}}`}</style>
      {guidance ? <section className="public-evac-guidance" aria-label="จุดรวมพลและคำสั่งหลังออก"><style>{`.public-evac-guidance{display:grid;gap:10px;margin:0 0 16px;padding:14px 16px;border:1px solid #f3c38d;border-left:4px solid #f97316;border-radius:12px;background:#fff7ed;color:var(--ink)}.public-evac-guidance h1,.public-evac-guidance h2,.public-evac-guidance p{margin:0}.public-evac-guidance h1{font-size:17px}.public-evac-guidance p{color:var(--muted);font-size:12px;line-height:1.55}.public-evac-guidance-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.public-evac-guidance-card{display:grid;gap:3px;padding:10px;border:1px solid #f3c38d;border-radius:9px;background:#fff}.public-evac-guidance-card strong{font-size:13px}.public-evac-guidance-card span{color:var(--muted);font-size:12px;line-height:1.5}@media(max-width:767px){.public-evac-guidance-grid{grid-template-columns:1fr}}`}</style><h1>จุดรวมพลและคำสั่งหลังออกจากอาคาร</h1><p>แผนฉบับ {guidance.versionCode} · มีผล {guidance.effectiveDate ? new Date(guidance.effectiveDate).toLocaleDateString('th-TH') : 'ไม่ระบุ'} · หากเกิดเหตุให้ทำตามป้ายและคำสั่งเจ้าหน้าที่</p>{guidance.reportPoint ? <div className="public-evac-guidance-card"><strong>จุดรายงานตัว: {guidance.reportPoint.nameTh}</strong><span>{guidance.reportPoint.detailTh ?? 'ไปยังจุดรายงานตัวและรอการนับคน'}</span></div> : null}<div className="public-evac-guidance-grid">{stationAssignments.map(assignment => <div className="public-evac-guidance-card" key={`${assignment.scopeCode}-${assignment.routeVariant}`}><strong>{assignment.routeVariant === 'primary' ? 'ทางออกหลัก' : 'ทางออกสำรอง'} · {assignment.exitCode}</strong><span>{assignment.postExitInstructionTh ?? 'ไปยังจุดรวมพล ห้ามย้อนกลับเข้าอาคาร และรอการนับคน'}</span></div>)}{!stationAssignments.length ? <div className="public-evac-guidance-card"><strong>ปฏิบัติตามเส้นทางบนแผนที่</strong><span>ยังไม่มีคำสั่งเฉพาะจุดนี้ในแผนเผยแพร่ กรุณาปฏิบัติตามป้ายและเจ้าหน้าที่</span></div> : null}</div></section> : null}
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
