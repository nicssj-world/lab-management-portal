import { cookies } from 'next/headers'
import { PublicSurveyForm } from '@/components/satisfaction/PublicSurveyForm'
import { DEVICE_COOKIE_NAME, getPublicSurveyState } from '@/lib/surveys/public-server'

export const dynamic = 'force-dynamic'

export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const cookieStore = await cookies()
  const state = await getPublicSurveyState(token, cookieStore.get(DEVICE_COOKIE_NAME)?.value)
  return (
    <main style={{ minHeight: '100vh', background: 'var(--surface)', padding: 'clamp(12px,4vw,32px)' }}>
      <div style={{ width: 'min(760px,100%)', margin: '0 auto' }}>
        {state ? <PublicSurveyForm token={token} initialState={state} /> : <div role="alert" style={{ marginTop: '12vh', padding: 28, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, textAlign: 'center' }}><h1 style={{ color: 'var(--ink)' }}>ไม่พบแบบสำรวจ</h1><p style={{ color: 'var(--muted)' }}>กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง</p></div>}
      </div>
    </main>
  )
}
