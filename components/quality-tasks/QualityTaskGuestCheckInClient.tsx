'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import type { CheckInContext } from '@/lib/quality-tasks/check-in'

function fmt(value: string | null) {
  return value
    ? new Date(`${value}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
    : null
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'choice'; context: CheckInContext; challenge: string }
  | { phase: 'guest-form'; context: CheckInContext; challenge: string }
  | { phase: 'done'; context: CheckInContext }

const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block' }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}

/**
 * เช็คอินสาธารณะสำหรับผู้ไม่มีบัญชีในระบบ — /checkin/[token]
 *
 * หน้านี้ (app/checkin/[token]/page.tsx) render component นี้เฉพาะตอนที่ browser ไม่มี
 * session อยู่แล้ว ถ้ามี session จะ render QualityTaskCheckInClient เดิมแทน (ปุ่มกดเช็คอินตรง)
 * ที่นี่จึงต้องถามก่อนว่า "มีบัญชีไหม" — มี → ไปหน้า login แล้วพากลับมาที่ QR เดิม,
 * ไม่มี → กรอกชื่อ-นามสกุล-หน่วยงานเพื่อเช็คอินแทน (หน่วยงานไปลงคอลัมน์ "ตำแหน่ง" ในใบลงนาม)
 */
export function QualityTaskGuestCheckInClient({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [busy, setBusy] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [department, setDepartment] = useState('')
  const honeypotRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/quality-tasks/check-in/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) { setState({ phase: 'error', message: json.error ?? 'ไม่พบ QR สำหรับการประชุมนี้' }); return }
        if (json.loggedIn) {
          // ไม่ควรเกิดขึ้น (หน้านี้ render เฉพาะตอนไม่มี session) แต่กันไว้ไม่ให้ค้างที่ choice เปล่าๆ
          window.location.reload()
          return
        }
        setState({ phase: 'choice', context: json.context as CheckInContext, challenge: json.challenge as string })
      })
      .catch(() => { if (!cancelled) setState({ phase: 'error', message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }) })
    return () => { cancelled = true }
  }, [token])

  function goToLogin() {
    window.location.href = `/login?next=${encodeURIComponent(`/checkin/${token}`)}`
  }

  async function submitGuest(e: React.FormEvent) {
    e.preventDefault()
    if (state.phase !== 'guest-form') return
    if (!firstName.trim() || !lastName.trim() || !department.trim()) return
    setBusy(true)
    try {
      const res = await fetch(`/api/quality-tasks/check-in/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName, lastName, department,
          challenge: state.challenge,
          website: honeypotRef.current?.value ?? '',
        }),
      })
      const json = await res.json()
      if (!res.ok) { setState({ phase: 'error', message: json.error ?? 'เช็คอินไม่สำเร็จ' }); return }
      setState({ phase: 'done', context: state.context })
    } catch {
      setState({ phase: 'error', message: 'เช็คอินไม่สำเร็จ กรุณาลองใหม่' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '40px auto', display: 'grid', gap: 16 }}>
      <Card padding={24} style={{ textAlign: 'center' }}>
        {state.phase === 'loading' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ height: 22, borderRadius: 6, background: 'var(--surface-2)', width: '70%', margin: '0 auto' }} />
            <div style={{ height: 14, borderRadius: 6, background: 'var(--surface-2)', width: '50%', margin: '0 auto' }} />
          </div>
        )}

        {state.phase === 'error' && (
          <>
            <Icon name="alert" size={32} style={{ color: 'var(--danger)' }} />
            <h1 style={{ fontSize: 17, margin: '10px 0 4px', color: 'var(--ink)' }}>เช็คอินไม่สำเร็จ</h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{state.message}</p>
          </>
        )}

        {(state.phase === 'choice' || state.phase === 'guest-form') && (
          <>
            <Icon name="qr" size={32} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontSize: 17, margin: '10px 0 2px', color: 'var(--ink)' }}>{state.context.title}</h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>
              {fmt(state.context.plannedDate) ?? state.context.periodLabel}
            </p>

            {state.context.closed ? (
              <p style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, background: 'var(--surface-2)', color: 'var(--muted)', fontSize: 13 }}>
                <Icon name="lock" size={14} /> การประชุมนี้ปิดงานแล้ว ไม่รับเช็คอินเพิ่ม
              </p>
            ) : state.phase === 'choice' ? (
              <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
                <p style={{ margin: 0, color: 'var(--ink)', fontSize: 13.5, fontWeight: 700 }}>คุณมีบัญชีผู้ใช้ในระบบนี้หรือไม่?</p>
                <Button variant="primary" onClick={goToLogin}>มีบัญชี — เข้าสู่ระบบเพื่อเช็คอิน</Button>
                <Button variant="secondary" onClick={() => setState({ phase: 'guest-form', context: state.context, challenge: state.challenge })}>
                  ไม่มีบัญชี — กรอกข้อมูลเพื่อเช็คอิน
                </Button>
              </div>
            ) : (
              <form onSubmit={submitGuest} noValidate style={{ marginTop: 16, display: 'grid', gap: 10, textAlign: 'left' }}>
                <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
                  <label htmlFor="qt-hp-field">กรุณาปล่อยช่องนี้ว่างไว้</label>
                  <input
                    ref={honeypotRef} id="qt-hp-field" name="qt_extra_note" type="text"
                    tabIndex={-1} autoComplete="off" data-lpignore="true" data-1p-ignore="" data-bwignore="true" data-form-type="other"
                  />
                </div>
                <label style={labelStyle}>
                  ชื่อ
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  นามสกุล
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} required />
                </label>
                <label style={labelStyle}>
                  หน่วยงาน
                  <input value={department} onChange={(e) => setDepartment(e.target.value)} style={inputStyle} required />
                </label>
                <Button
                  type="submit"
                  variant="primary"
                  icon="check"
                  disabled={busy || !firstName.trim() || !lastName.trim() || !department.trim()}
                >
                  {busy ? 'กำลังเช็คอิน…' : 'ยืนยันเช็คอิน'}
                </Button>
                <button
                  type="button"
                  onClick={() => setState({ phase: 'choice', context: state.context, challenge: state.challenge })}
                  style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 12.5, cursor: 'pointer', padding: 4 }}
                >
                  ← ย้อนกลับ
                </button>
              </form>
            )}
          </>
        )}

        {state.phase === 'done' && (
          <>
            <Icon name="shieldCheck" size={32} style={{ color: 'var(--success)' }} />
            <h1 style={{ fontSize: 17, margin: '10px 0 2px', color: 'var(--ink)' }}>เช็คอินสำเร็จ</h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{state.context.title}</p>
          </>
        )}
      </Card>
    </div>
  )
}
