import { createClient } from '@/lib/supabase/server'
import { QualityTaskCheckInClient } from '@/components/quality-tasks/QualityTaskCheckInClient'
import { QualityTaskGuestCheckInClient } from '@/components/quality-tasks/QualityTaskGuestCheckInClient'

// หน้านี้อยู่ระดับบนสุดของ app/ (เหมือน app/v/ และ app/s/) จึงไม่ผ่าน
// PROTECTED_PATH_PATTERN ใน lib/auth/session-guard.ts → เป็น public โดยไม่ต้องแก้ proxy
export const dynamic = 'force-dynamic'

// มี session อยู่แล้ว → ใช้ปุ่มเช็คอินตรงเดิม (QualityTaskCheckInClient ที่ /staff/quality-tasks/check-in ก็ใช้)
// ไม่มี session → ต้องถามก่อนว่ามีบัญชีไหม แล้วค่อยพาไป login หรือกรอกชื่อ-นามสกุล-หน่วยงานแทน
export default async function PublicQualityTaskCheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main style={{ minHeight: '100vh', padding: 24, background: 'var(--surface)' }}>
      {user ? <QualityTaskCheckInClient token={token} /> : <QualityTaskGuestCheckInClient token={token} />}
    </main>
  )
}
