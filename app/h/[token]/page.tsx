import { headers } from 'next/headers'
import { PublicHeadContactForm } from '@/components/head-contact/PublicHeadContactForm'
import { createHeadContactChallenge, getPublicHeadContactFormState } from '@/lib/head-contact/public-server'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

export const dynamic = 'force-dynamic'

export default async function HeadContactPublicPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const requestHeaders = await headers()
  const limit = consumeRateLimit({
    key: `head-contact-page:${privateRequestKey('head-contact-page-ip', getClientIp(requestHeaders))}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!limit.allowed) return <PageMessage title="มีคำขอมากเกินไป" detail="กรุณารอสักครู่แล้วเปิดแบบฟอร์มอีกครั้ง" />

  const state = await getPublicHeadContactFormState(token)
  const challenge = state ? createHeadContactChallenge(token) : null
  return state && challenge
    ? <PublicHeadContactForm token={token} initialState={state} challenge={challenge} />
    : <PageMessage title="ไม่พบแบบฟอร์ม" detail="กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง" />
}

function PageMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center', background: '#EDF6F5' }}>
      <div role="alert" style={{ width: 'min(520px,100%)', padding: 30, borderRadius: 22, background: '#fff', border: '1px solid #D7E4E2', textAlign: 'center', boxShadow: '0 24px 60px rgba(15,71,68,.12)' }}>
        <h1 style={{ margin: 0, color: '#123C3A', fontSize: 24 }}>{title}</h1>
        <p style={{ margin: '10px 0 0', color: '#57706E' }}>{detail}</p>
      </div>
    </main>
  )
}
