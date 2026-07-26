import { cookies, headers } from 'next/headers'
import { PublicVisitorForm } from '@/components/it-visitor/PublicVisitorForm'
import {
  createVisitorChallenge,
  getActiveVisitorBySecret,
  getPublicVisitorFormState,
} from '@/lib/it-visitor/public-server'
import { buildVisitorLabMapDTO } from '@/lib/lab-map/visitor'
import { getPublishedLabMapSnapshot } from '@/lib/lab-map/server'
import { consumeRateLimit } from '@/lib/security/rate-limit'
import { getClientIp, privateRequestKey } from '@/lib/security/request-protection'

// หน้านี้อยู่ระดับบนสุดของ app/ (เหมือน app/s/ และ app/e/) จึงไม่ผ่าน
// PROTECTED_PATH_PATTERN ใน lib/auth/session-guard.ts → เป็น public โดยไม่ต้องแก้ proxy
export const dynamic = 'force-dynamic'

export default async function PublicVisitorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const requestHeaders = await headers()
  const viewLimit = consumeRateLimit({
    key: `visitor-page:${privateRequestKey('visitor-page-ip', getClientIp(requestHeaders))}`,
    limit: 300,
    windowMs: 10 * 60 * 1000,
  })
  if (!viewLimit.allowed) {
    return <VisitorPageMessage title="มีคำขอมากเกินไป" detail="กรุณารอสักครู่แล้วลองเปิดแบบฟอร์มอีกครั้ง" />
  }

  const state = await getPublicVisitorFormState(token)
  const challenge = state ? createVisitorChallenge(token) : null
  const cookieStore = await cookies()
  const checkoutSecret = cookieStore.get('lab_visitor_checkout')?.value
  const initialActiveVisit = state && checkoutSecret
    ? await getActiveVisitorBySecret(checkoutSecret)
    : null
  const publishedMap = state ? await getPublishedLabMapSnapshot() : null

  return (
    <main className="public-visitor-page">
      <style>{`
        .public-visitor-page{min-height:100vh;padding:clamp(16px,4vw,42px) clamp(12px,4vw,32px) 56px;background:radial-gradient(circle at 0 0,rgba(3,105,161,.14),transparent 32%),radial-gradient(circle at 100% 18%,rgba(37,99,235,.10),transparent 28%),var(--surface)}
        .public-visitor-page-inner{width:min(760px,100%);margin:0 auto}
        .public-visitor-not-found{margin-top:12vh;padding:32px 24px;background:var(--card);border:1px solid var(--border);border-radius:20px;text-align:center;box-shadow:0 16px 40px rgba(15,23,42,.08)}
      `}</style>
      <div className="public-visitor-page-inner">
        {state && challenge ? (
          <PublicVisitorForm
            token={token}
            initialState={state}
            challenge={challenge}
            initialActiveVisit={initialActiveVisit}
            visitorMap={buildVisitorLabMapDTO(publishedMap)}
          />
        ) : (
          <div role="alert" className="public-visitor-not-found">
            <h1 style={{ color: 'var(--ink)', margin: 0, fontSize: 22 }}>ไม่พบแบบฟอร์ม</h1>
            <p style={{ color: 'var(--muted)', margin: '8px 0 0' }}>กรุณาตรวจสอบ QR Code หรือลิงก์อีกครั้ง</p>
          </div>
        )}
      </div>
    </main>
  )
}

function VisitorPageMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <main style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div role="alert" style={{ width: 'min(520px,100%)', padding: 28, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 18, textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        <p style={{ margin: '8px 0 0', color: 'var(--muted)' }}>{detail}</p>
      </div>
    </main>
  )
}
