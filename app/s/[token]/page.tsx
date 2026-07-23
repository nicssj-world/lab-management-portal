import { cookies, headers } from 'next/headers'
import { PublicSurveyForm } from '@/components/satisfaction/PublicSurveyForm'
import { createPublicSurveyChallenge, DEVICE_COOKIE_NAME, getPublicSurveyState } from '@/lib/surveys/public-server'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

export const dynamic = 'force-dynamic'

export default async function PublicSurveyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const requestHeaders = await headers()
  const viewLimit = consumeRateLimit({
    key: `survey-page:${privateRequestKey('survey-page-ip', getClientIp(requestHeaders))}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!viewLimit.allowed) {
    return <SurveyPageMessage title="มีคำขอมากเกินไป" detail="กรุณารอสักครู่แล้วลองเปิดแบบสำรวจอีกครั้ง" />
  }
  const cookieStore = await cookies()
  const state = await getPublicSurveyState(token, cookieStore.get(DEVICE_COOKIE_NAME)?.value)
  const challenge = state ? createPublicSurveyChallenge(token) : null
  return (
    <main className="public-survey-page">
      <style>{`
        .public-survey-page{min-height:100vh;padding:clamp(16px,4vw,42px) clamp(12px,4vw,32px) 56px;background:radial-gradient(circle at 0 0,rgba(13,148,136,.14),transparent 32%),radial-gradient(circle at 100% 18%,rgba(37,99,235,.10),transparent 28%),var(--surface)}
        .public-survey-page-inner{width:min(760px,100%);margin:0 auto}
        .public-survey-not-found{margin-top:12vh;padding:32px 24px;background:var(--card);border:1px solid var(--border);border-radius:20px;text-align:center;box-shadow:0 16px 40px rgba(15,23,42,.08)}
      `}</style>
      <div className="public-survey-page-inner">
        {state && challenge ? <PublicSurveyForm token={token} initialState={state} challenge={challenge} /> : <div role="alert" className="public-survey-not-found"><h1 style={{ color: 'var(--ink)', margin: 0, fontSize: 22 }}>ไม่พบแบบสำรวจ</h1><p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง</p></div>}
      </div>
    </main>
  )
}

function SurveyPageMessage({ title, detail }: { title: string; detail: string }) {
  return <main style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center', background: 'var(--surface)' }}><div role="alert" style={{ width: 'min(520px,100%)', padding: 28, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, textAlign: 'center' }}><h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1><p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>{detail}</p></div></main>
}
