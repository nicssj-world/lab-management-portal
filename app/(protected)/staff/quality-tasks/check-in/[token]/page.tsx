import { QualityTaskCheckInClient } from '@/components/quality-tasks/QualityTaskCheckInClient'

// ไม่เช็ค permission matrix ของ "งานคุณภาพ" โดยตั้งใจ — เหมือนหน้ารายงานอุบัติการณ์
// ใครสแกน QR แล้วล็อกอินอยู่ต้องเช็คอินได้ (proxy.ts เด้งไป /login?next=... ให้เองถ้ายังไม่ล็อกอิน)
export default async function QualityTaskCheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <QualityTaskCheckInClient token={token} />
}
