'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorBanner, Field, Panel } from './shared/ui'
import {
  FONT, INCIDENT_CATEGORIES, LAB_DEPARTMENTS, REPORTER_POSITIONS, SPACE,
  inputStyle, tabularNums, textareaStyle, todayIso,
} from './shared/tokens'

type Draft = {
  event_date: string
  event_time: string
  department_found: string
  department_target: string
  event_category: string
  event_detail: string
  immediate_correction: string
  reporter_position: string
  reporter_name: string
}

const DRAFT_KEY = 'risk.incident-report.draft'

const EMPTY: Draft = {
  event_date: todayIso(),
  event_time: '',
  department_found: '',
  department_target: '',
  event_category: '',
  event_detail: '',
  immediate_correction: '',
  reporter_position: '',
  reporter_name: '',
}

function validate(draft: Draft): Partial<Record<keyof Draft, string>> {
  const errors: Partial<Record<keyof Draft, string>> = {}
  if (!draft.event_date) errors.event_date = 'ต้องระบุวันที่เกิดเหตุการณ์'
  else if (draft.event_date > todayIso()) errors.event_date = 'วันที่เกิดเหตุต้องไม่เกินวันนี้'
  if (!draft.department_found) errors.department_found = 'ต้องเลือกหน่วยงานที่พบเหตุการณ์'
  if (!draft.event_category) errors.event_category = 'ต้องเลือกประเภทเหตุการณ์'
  if (!draft.event_detail.trim()) errors.event_detail = 'ต้องเล่ารายละเอียดเหตุการณ์'
  return errors
}

/**
 * ฟอร์มรายงานอุบัติการณ์สำหรับเจ้าหน้าที่ทุกคน
 *
 * คนที่ใช้หน้านี้ส่วนใหญ่ไม่ได้ใช้ระบบเป็นประจำ และมักกรอกระหว่างทำงานจริง
 * จึงบันทึกร่างอัตโนมัติ ตรวจข้อมูลตอนออกจากช่อง และยืนยันผลด้วยเลขที่เรื่องเมื่อส่งสำเร็จ
 */
export function IncidentReportForm({ reporterName, canSeeQueue, canRecordOnBehalf }: {
  reporterName: string | null
  canSeeQueue: boolean
  canRecordOnBehalf: boolean
}) {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<keyof Draft, boolean>>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState<{ id: number; report_no: string | null } | null>(null)
  const [draftRestored, setDraftRestored] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  // กู้ร่างที่ค้างไว้ — งานห้องแล็บถูกขัดจังหวะบ่อย ฟอร์มที่หายทั้งหมดคือเหตุผลที่คนเลิกรายงาน
  useEffect(() => {
    const stored = window.localStorage.getItem(DRAFT_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as Draft
      if (parsed.event_detail?.trim() || parsed.department_found) {
        setDraft({ ...EMPTY, ...parsed })
        setDraftRestored(true)
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    }
  }, [])

  useEffect(() => {
    if (submitted) return
    if (JSON.stringify(draft) === JSON.stringify(EMPTY)) return
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  }, [draft, submitted])

  const errors = validate(draft)
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const errorOf = (key: keyof Draft) => (touched[key] ? errors[key] : undefined)
  const blur = (key: keyof Draft) => () => setTouched(prev => ({ ...prev, [key]: true }))

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched({
      event_date: true, department_found: true, event_category: true, event_detail: true,
    })

    const firstInvalid = (Object.keys(errors) as (keyof Draft)[])[0]
    if (firstInvalid) {
      // พาโฟกัสไปที่ช่องแรกที่ยังไม่ผ่าน แทนที่จะให้ผู้ใช้ไล่หาเองว่าอะไรผิด
      formRef.current?.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus()
      return
    }

    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/risk/incidents/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...draft,
          event_time: draft.event_time || null,
          department_target: draft.department_target || null,
          immediate_correction: draft.immediate_correction || null,
          reporter_position: draft.reporter_position || null,
          reporter_name: canRecordOnBehalf ? draft.reporter_name.trim() || null : null,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'ส่งรายงานไม่สำเร็จ')
      window.localStorage.removeItem(DRAFT_KEY)
      setSubmitted(json.data)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (submitted) {
    return (
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
        <PageHeader eyebrow="INCIDENT REPORT" title="ส่งรายงานเรียบร้อยแล้ว" marginBottom={0} />
        <Panel>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACE.sm, padding: `${SPACE.lg}px ${SPACE.md}px`, textAlign: 'center' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 60, height: 60, borderRadius: 16, background: 'color-mix(in srgb, var(--success) 12%, transparent)', color: 'var(--success)' }}>
              <Icon name="shieldCheck" size={30} />
            </span>
            <p style={{ margin: 0, fontSize: FONT.lg, fontWeight: 700, color: 'var(--ink)' }}>
              ขอบคุณที่รายงาน เรื่องเข้าสู่คิวทบทวนแล้ว
            </p>
            <p style={{ margin: 0, fontSize: FONT.md, color: 'var(--muted)', ...tabularNums }}>
              เลขที่เรื่อง <strong style={{ color: 'var(--ink)' }}>{submitted.report_no ?? `#${submitted.id}`}</strong>
            </p>
            <p style={{ margin: 0, maxWidth: 460, fontSize: FONT.md, color: 'var(--muted)', lineHeight: 1.7 }}>
              ผู้มีสิทธิ์ทบทวนจะกำหนดระดับความรุนแรงและมาตรการแก้ไขต่อไป
              ไม่ต้องกรอกซ้ำแม้เพื่อนร่วมงานจะรายงานเรื่องเดียวกัน
            </p>
            <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Button variant="primary" icon="plus" onClick={() => { setSubmitted(null); setDraft(EMPTY); setTouched({}) }}>
                รายงานเรื่องใหม่
              </Button>
              {canSeeQueue && (
                <Link
                  href="/staff/risk/ior?status=reported"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44, padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--ink)', fontSize: FONT.md, fontWeight: 600, textDecoration: 'none' }}
                >
                  <Icon name="inbox" size={15} />ดูคิวรอทบทวน
                </Link>
              )}
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  return (
    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {/* หน้านี้ไม่มีเมนูโมดูล (เป็นงานเดี่ยว) จึงต้องคืนทางกลับให้คนที่กดมาจากทะเบียน */}
      {canSeeQueue && (
        <Link
          href="/staff/risk/ior"
          style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, minHeight: 44, padding: '8px 4px', color: 'var(--muted)', fontSize: FONT.md, fontWeight: 600, textDecoration: 'none' }}
        >
          <Icon name="arrowLeft" size={15} />กลับไปทะเบียนอุบัติการณ์
        </Link>
      )}

      <PageHeader
        eyebrow="INCIDENT REPORT"
        title="รายงานอุบัติการณ์"
        subtitle="เจ้าหน้าที่ทุกคนรายงานได้ ไม่ต้องระบุระดับความรุนแรง — รายงานเพื่อให้ระบบดีขึ้น ไม่ใช่เพื่อหาคนผิด"
        marginBottom={0}
      />

      {draftRestored && (
        <p style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 7, padding: SPACE.sm, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: FONT.md }}>
          <Icon name="clock" size={15} />
          กู้ร่างที่กรอกค้างไว้ให้แล้ว ตรวจสอบก่อนส่งได้เลย
        </p>
      )}

      <ErrorBanner message={error} />

      <Panel>
        <form ref={formRef} onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)' }}>
            ช่องที่มี <span style={{ color: 'var(--danger)' }}>*</span> ต้องกรอก
            {reporterName && <> · ระบบบันทึกชื่อผู้รายงานเป็น <strong style={{ color: 'var(--ink)' }}>{reporterName}</strong> ให้อัตโนมัติ</>}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm }}>
            <Field label="วันที่เกิดเหตุการณ์" required error={errorOf('event_date')} htmlFor="event_date">
              <input
                id="event_date" name="event_date" type="date" max={todayIso()}
                value={draft.event_date}
                onChange={e => set({ event_date: e.target.value })}
                onBlur={blur('event_date')}
                style={inputStyle}
              />
            </Field>

            <Field label="เวลาโดยประมาณ" hint="ไม่บังคับ" htmlFor="event_time">
              <input
                id="event_time" name="event_time" type="time"
                value={draft.event_time}
                onChange={e => set({ event_time: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <Field label="หน่วยงานที่พบเหตุการณ์" required error={errorOf('department_found')} htmlFor="department_found">
              <select
                id="department_found" name="department_found"
                value={draft.department_found}
                onChange={e => set({ department_found: e.target.value })}
                onBlur={blur('department_found')}
                style={inputStyle}
              >
                <option value="">— เลือกหน่วยงาน —</option>
                {LAB_DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>

            <Field label="ส่งเรื่องถึงหน่วยงาน" hint="ไม่บังคับ" htmlFor="department_target">
              <input
                id="department_target" name="department_target"
                value={draft.department_target}
                onChange={e => set({ department_target: e.target.value })}
                style={inputStyle}
              />
            </Field>

            <Field label="ตำแหน่งของคุณ" hint="ไม่บังคับ" htmlFor="reporter_position">
              <select
                id="reporter_position" name="reporter_position"
                value={draft.reporter_position}
                onChange={e => set({ reporter_position: e.target.value })}
                style={inputStyle}
              >
                <option value="">— ไม่ระบุ —</option>
                {REPORTER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </Field>

            {canRecordOnBehalf && (
              <Field
                label="ผู้รายงาน"
                hint="เว้นว่างถ้ารายงานด้วยตัวเอง — กรอกชื่อเมื่อบันทึกแทนผู้ที่แจ้งทางโทรศัพท์หรือใบกระดาษ"
                htmlFor="reporter_name"
              >
                <input
                  id="reporter_name" name="reporter_name"
                  value={draft.reporter_name}
                  onChange={e => set({ reporter_name: e.target.value })}
                  placeholder={reporterName ?? ''}
                  style={inputStyle}
                />
              </Field>
            )}
          </div>

          <Field label="ประเภทเหตุการณ์" required error={errorOf('event_category')} htmlFor="event_category">
            <select
              id="event_category" name="event_category"
              value={draft.event_category}
              onChange={e => set({ event_category: e.target.value })}
              onBlur={blur('event_category')}
              style={inputStyle}
            >
              <option value="">— เลือกประเภทที่ใกล้เคียงที่สุด —</option>
              {INCIDENT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <Field
            label="เกิดเหตุการณ์อย่างไร"
            required
            error={errorOf('event_detail')}
            hint="เล่าตามที่เกิดจริง ไม่ต้องระบุชื่อผู้เกี่ยวข้อง"
            htmlFor="event_detail"
          >
            <textarea
              id="event_detail" name="event_detail"
              value={draft.event_detail}
              onChange={e => set({ event_detail: e.target.value })}
              onBlur={blur('event_detail')}
              style={{ ...textareaStyle, minHeight: 120 }}
            />
          </Field>

          <Field
            label="แก้ไขเฉพาะหน้าอย่างไร"
            hint="ไม่บังคับ — ทำอะไรไปแล้วบ้างเพื่อจัดการหน้างานตอนนั้น"
            htmlFor="immediate_correction"
          >
            <textarea
              id="immediate_correction" name="immediate_correction"
              value={draft.immediate_correction}
              onChange={e => set({ immediate_correction: e.target.value })}
              style={textareaStyle}
            />
          </Field>

          <div style={{ display: 'flex', gap: SPACE.xs, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              onClick={() => {
                if (!window.confirm('ล้างข้อมูลที่กรอกไว้ทั้งหมดหรือไม่')) return
                window.localStorage.removeItem(DRAFT_KEY)
                setDraft(EMPTY)
                setTouched({})
                setDraftRestored(false)
              }}
              disabled={saving}
            >
              ล้างฟอร์ม
            </Button>
            <Button variant="primary" type="submit" icon="check" disabled={saving}>
              {saving ? 'กำลังส่ง…' : 'ส่งรายงาน'}
            </Button>
          </div>
        </form>
      </Panel>
    </div>
  )
}
