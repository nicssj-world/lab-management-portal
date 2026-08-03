'use client'

import { useEffect, useState } from 'react'
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
  | { phase: 'ready'; context: CheckInContext }
  | { phase: 'done'; context: CheckInContext; wasUnlisted: boolean; already: boolean }

/**
 * หน้าเช็คอินการประชุมจาก QR — เปิดได้เฉพาะผู้ที่ล็อกอินอยู่
 * (proxy.ts เด้งไป /login?next=... ให้เองถ้ายังไม่ล็อกอิน แล้วพากลับมาที่นี่หลังล็อกอินสำเร็จ)
 *
 * ตั้งใจให้ต้องกดยืนยันเอง ไม่เช็คอินอัตโนมัติทันทีที่เปิดหน้า — เพราะนี่คือบันทึกการเข้าร่วมประชุม
 * ที่มีผลเป็นหลักฐานคุณภาพ เปิดลิงก์ดูเฉยๆ ไม่ควรถูกนับว่าเข้าร่วม
 */
export function QualityTaskCheckInClient({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ phase: 'loading' })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/quality-tasks/check-in/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) { setState({ phase: 'error', message: json.error ?? 'ไม่พบ QR สำหรับการประชุมนี้' }); return }
        setState({ phase: 'ready', context: json.context as CheckInContext })
      })
      .catch(() => { if (!cancelled) setState({ phase: 'error', message: 'เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่' }) })
    return () => { cancelled = true }
  }, [token])

  async function confirm() {
    if (state.phase !== 'ready') return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/quality-tasks/check-in/${token}`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setState({ phase: 'error', message: json.error ?? 'เช็คอินไม่สำเร็จ' }); return }
      setState({ phase: 'done', context: state.context, wasUnlisted: Boolean(json.wasUnlisted), already: Boolean(json.already) })
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

        {state.phase === 'ready' && (
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
            ) : state.context.alreadyCheckedIn ? (
              <p style={{ marginTop: 16, padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--success) 10%, var(--card))', color: 'var(--success)', fontSize: 13.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Icon name="check" size={15} /> คุณเช็คอินการประชุมนี้แล้ว
              </p>
            ) : (
              <div style={{ marginTop: 18 }}>
                <Button variant="primary" icon="check" disabled={busy} onClick={() => void confirm()}>
                  {busy ? 'กำลังเช็คอิน…' : 'ยืนยันเช็คอิน'}
                </Button>
              </div>
            )}
          </>
        )}

        {state.phase === 'done' && (
          <>
            <Icon name="shieldCheck" size={32} style={{ color: 'var(--success)' }} />
            <h1 style={{ fontSize: 17, margin: '10px 0 2px', color: 'var(--ink)' }}>
              {state.already ? 'เช็คอินแล้ว' : 'เช็คอินสำเร็จ'}
            </h1>
            <p style={{ margin: 0, color: 'var(--muted)', fontSize: 13.5 }}>{state.context.title}</p>
            {state.wasUnlisted && (
              <p style={{ marginTop: 12, padding: '9px 12px', borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 12.5 }}>
                ชื่อคุณไม่ได้อยู่ในรายชื่อผู้เข้าร่วมเดิม ระบบเพิ่มเข้ารายชื่อและใบลงนามให้อัตโนมัติแล้ว
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
