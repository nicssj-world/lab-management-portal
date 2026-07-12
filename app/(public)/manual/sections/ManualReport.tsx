import React, { useState } from 'react'
import { H2, Section } from '../_primitives'
import { CRITICAL_VALUES, type CriticalValue, type Lang } from '../data'
import { useManualTable } from '../ManualTablesContext'
import { ManualTableEditor } from '@/components/manual/ManualTableEditor'
import { TABLE_SCHEMAS, type EditableRow } from '../tables'

interface Props { lang: Lang }

// ── ISBAR steps ───────────────────────────────────────────────────────────────

const ISBAR_STEPS = [
  {
    letter: 'I', label: 'Identify',
    th: 'ผู้รายงานระบุ ชื่อ-สกุล ตำแหน่ง หน่วยงาน — ปลายสายระบุชื่อ-สกุล (แพทย์) ผู้รับรายงาน',
    en: 'Reporter states name, role, section. Receiving physician states their name.',
  },
  {
    letter: 'S', label: 'Situation',
    th: 'ผู้รายงานกล่าวสถานการณ์ที่พบ — ค่าวิกฤติของผู้ป่วย: ชื่อ-สกุล · HN. · รายการทดสอบ · ค่าที่พบ',
    en: 'Reporter announces: critical result for patient name, HN, test, value.',
  },
  {
    letter: 'B', label: 'Background',
    th: 'หากแพทย์เจ้าของไข้ติดต่อไม่ได้ ลำดับ: แพทย์ที่ 1 → 2 → 3 → หัวหน้ากลุ่มงานฯ (สิ้นสุดการแจ้ง)',
    en: 'If attending unreachable: escalate MD #1 → #2 → #3 → dept. head (terminates chain).',
  },
  {
    letter: 'A', label: 'Assessment / Recommendation',
    th: 'แพทย์ผู้รับ Write down ใน Doctor order sheet / OPD record และ Read back เพื่อยืนยัน',
    en: 'Receiving MD writes on Doctor Order Sheet / OPD record and reads back to confirm.',
  },
  {
    letter: 'R', label: 'Record',
    th: 'ผู้รายงาน confirm ข้อมูลตรงกับที่รายงาน และบันทึกชื่อแพทย์ผู้รับรายงานในระบบ CFS',
    en: "Reporter confirms accuracy and records the receiving MD's name in CFS.",
  },
]

// ── Critical value categories ─────────────────────────────────────────────────

const CV_CATEGORIES: { labelTh: string; labelEn: string; keys: string[] }[] = [
  { labelTh: 'เคมีคลินิก',    labelEn: 'Chemistry',    keys: ['Sodium (Na)', 'Potassium (K)', 'Glucose', 'Magnesium', 'Troponin T (hs)'] },
  { labelTh: 'โลหิตวิทยา',    labelEn: 'Hematology',   keys: ['WBC', 'Platelet', 'PT INR', 'PTT'] },
  { labelTh: 'จุลชีววิทยา',   labelEn: 'Microbiology', keys: ['Hemoculture / Body fluid'] },
]

const CAT_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  'เคมีคลินิก':  { color: 'var(--primary)', bg: 'rgba(30,95,173,.06)',  border: 'rgba(30,95,173,.15)' },
  'โลหิตวิทยา':  { color: '#7C3AED',        bg: 'rgba(124,58,237,.06)', border: 'rgba(124,58,237,.15)' },
  'จุลชีววิทยา': { color: '#0891B2',        bg: 'rgba(8,145,178,.06)',  border: 'rgba(8,145,178,.15)' },
}

const ISBAR_COLORS = ['#DC2626', '#EA580C', '#D97706', '#16A34A', '#1E5FAD']

// ── Component ────────────────────────────────────────────────────────────────

export function ManualReport({ lang }: Props) {
  const [editing, setEditing] = useState(false)
  const critical = useManualTable<CriticalValue>('criticalValues', 'report', CRITICAL_VALUES)
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════
          SECTION 1 — Header + 15-min urgency display + intro
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <H2 eyebrow="05 · Reporting">
          {lang === 'th' ? 'การรายงานผลการตรวจวิเคราะห์ และค่าวิกฤติ' : 'Result Reporting & Critical Values'}
        </H2>

        {/* Intro */}
        <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.8, margin: '0 0 16px' }}>
          {lang === 'th'
            ? 'รายงานผลผ่านระบบสารสนเทศ LIS / HIS หรือพิมพ์ใบรายงานผลจาก HIS ให้ผู้รับบริการที่ร้องขอ — กลุ่มงานเทคนิคการแพทย์ไม่รายงานผลทางโทรศัพท์ในทุกกรณี ยกเว้นการรายงานค่าวิกฤติตามขั้นตอนด้านล่าง'
            : 'Results are reported via LIS / HIS or printed from HIS on request. The lab does NOT report results by phone — except critical values via the protocol below.'}
        </p>

        {/* 15-minute hero alarm */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '18px 22px',
          background: 'rgba(220,38,38,.05)',
          border: '1.5px solid rgba(220,38,38,.25)',
          borderRadius: 12,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Background pulse ring */}
          <div style={{
            position: 'absolute', right: -20, top: '50%', transform: 'translateY(-50%)',
            width: 140, height: 140, borderRadius: '50%',
            background: 'rgba(220,38,38,.04)',
            border: '1px solid rgba(220,38,38,.08)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(220,38,38,.06)',
            border: '1px solid rgba(220,38,38,.1)',
            pointerEvents: 'none',
          }} />

          {/* Timer display */}
          <div style={{
            flexShrink: 0, textAlign: 'center',
            padding: '10px 18px',
            background: 'var(--danger)',
            borderRadius: 10,
            boxShadow: '0 4px 16px rgba(220,38,38,.3)',
          }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: '#fff', lineHeight: 1, letterSpacing: '-.04em' }}>15</div>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.85)', letterSpacing: '.08em', marginTop: 2 }}>
              {lang === 'th' ? 'นาที' : 'MIN'}
            </div>
          </div>

          {/* Message */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#B91C1C', marginBottom: 4, letterSpacing: '-.01em' }}>
              {lang === 'th' ? '⚡ กรอบเวลาการแจ้งค่าวิกฤติ' : '⚡ Critical Value Notification Window'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
              {lang === 'th'
                ? 'ต้องดำเนินการให้เสร็จสิ้นภายใน 15 นาที นับจากเวลาที่ Approve ผลในระบบ LIS'
                : 'Must be completed within 15 minutes of LIS result approval.'}
            </div>
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 2 — ISBAR protocol flow
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {lang === 'th' ? 'ขั้นตอนการแจ้งค่าวิกฤติ (ISBAR)' : 'Critical-value Notification — ISBAR Protocol'}
          </h3>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', padding: '3px 9px', background: 'var(--surface-2)', borderRadius: 5, border: '1px solid var(--border)', letterSpacing: '.04em' }}>
            HP-IPSG2-CBH-007
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {ISBAR_STEPS.map((step, i) => {
            const color = ISBAR_COLORS[i]
            const isLast = i === ISBAR_STEPS.length - 1
            return (
              <div key={i} style={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>

                {/* Left spine: letter badge + connector line */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 44, flexShrink: 0 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 900, fontSize: 16, color: '#fff',
                    background: color,
                    boxShadow: `0 2px 8px ${color}44`,
                    zIndex: 1,
                  }}>
                    {step.letter}
                  </div>
                  {!isLast && (
                    <div style={{ width: 2, flex: 1, minHeight: 14, background: `linear-gradient(to bottom, ${color}60, ${ISBAR_COLORS[i+1]}40)`, margin: '3px 0' }} />
                  )}
                </div>

                {/* Content card */}
                <div style={{
                  flex: 1, minWidth: 0,
                  marginLeft: 10,
                  marginBottom: isLast ? 0 : 8,
                  padding: '11px 14px',
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 9,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color, letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {step.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
                    {lang === 'th' ? step.th : step.en}
                  </div>
                </div>

              </div>
            )
          })}
        </div>

        {/* Escalation note */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, padding: '10px 14px', background: 'var(--primary-soft)', border: '1px solid rgba(30,95,173,.2)', borderRadius: 9 }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>📞</span>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>
            {lang === 'th'
              ? <span>หากไม่สามารถติดต่อแพทย์เจ้าของไข้ได้ ให้โทรประสาน <strong>งานประชาสัมพันธ์ กด 0</strong> เพื่อขอเบอร์โทรติดต่อแพทย์โดยตรง</span>
              : <span>If the attending physician is unreachable, dial <strong>0 (Public Relations)</strong> to obtain a direct line.</span>}
          </div>
        </div>
      </Section>

      {/* ══════════════════════════════════════════════════════════════════
          SECTION 3 — Critical values reference table
      ══════════════════════════════════════════════════════════════════ */}
      <Section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
            {lang === 'th' ? 'รายการค่าวิกฤติ (Critical Values)' : 'Critical-value Reference'}
          </h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {CV_CATEGORIES.map(cat => {
              const s = CAT_STYLE[cat.labelTh]
              return (
                <span key={cat.labelTh} style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
                  {lang === 'th' ? cat.labelTh : cat.labelEn}
                </span>
              )
            })}
          </div>
        </div>

        {critical.canEdit && !editing && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button onClick={() => setEditing(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--muted)', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              แก้ตาราง
            </button>
          </div>
        )}
        {editing ? (
          <ManualTableEditor schema={TABLE_SCHEMAS.criticalValues} rows={critical.rows as unknown as EditableRow[]}
            onSaved={rows => { critical.setRows(rows as unknown as CriticalValue[]); setEditing(false) }}
            onCancel={() => setEditing(false)} />
        ) : (
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', width: '28%' }}>
                  {lang === 'th' ? 'รายการ' : 'Analyte'}
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#B91C1C', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', background: 'rgba(220,38,38,.05)', width: '30%' }}>
                  {lang === 'th' ? '⚡ ผู้ใหญ่ (> 15 ปี)' : '⚡ Adult (> 15 yr)'}
                </th>
                <th style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#B91C1C', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', background: 'rgba(220,38,38,.05)', width: '30%' }}>
                  {lang === 'th' ? '⚡ เด็ก (0–15 ปี)' : '⚡ Pediatric (0–15 yr)'}
                </th>
                <th style={{ padding: '9px 10px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.05em', textTransform: 'uppercase', borderBottom: '2px solid var(--border)', width: '12%' }}>
                  {lang === 'th' ? 'หน่วย' : 'Unit'}
                </th>
              </tr>
            </thead>
            <tbody>
              {CV_CATEGORIES.map(cat => {
                const s = CAT_STYLE[cat.labelTh]
                const rows = critical.rows.filter(v => v.cat === cat.labelTh)
                return (
                  <React.Fragment key={cat.labelTh}>
                    {/* Category header row */}
                    <tr>
                      <td colSpan={4} style={{
                        padding: '6px 14px',
                        background: s.bg,
                        borderTop: '1px solid var(--border)',
                        borderBottom: `1px solid ${s.border}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 5, height: 5, borderRadius: '50%', background: s.color }} />
                          <span style={{ fontSize: 10.5, fontWeight: 800, color: s.color, letterSpacing: '.07em', textTransform: 'uppercase' }}>
                            {lang === 'th' ? cat.labelTh : cat.labelEn}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {rows.map(v => (
                      <tr key={v.test}
                        style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)' }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
                      >
                        <td style={{ padding: '9px 14px', color: 'var(--ink)', fontWeight: 700, fontSize: 13 }}>
                          {v.test}
                        </td>
                        <td style={{ padding: '9px 12px', background: v.adult !== '—' ? 'rgba(220,38,38,.03)' : undefined }}>
                          {v.adult === '—'
                            ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>
                            : <span style={{ color: '#B91C1C', fontWeight: 700, fontFamily: '"IBM Plex Mono",monospace', fontSize: 12.5, lineHeight: 1.5 }}>{v.adult}</span>
                          }
                        </td>
                        <td style={{ padding: '9px 12px', background: v.child !== '—' ? 'rgba(220,38,38,.03)' : undefined }}>
                          {v.child === '—'
                            ? <span style={{ color: 'var(--muted)', fontSize: 13 }}>—</span>
                            : <span style={{ color: '#B91C1C', fontWeight: 700, fontFamily: '"IBM Plex Mono",monospace', fontSize: 12.5, lineHeight: 1.5 }}>{v.child}</span>
                          }
                        </td>
                        <td style={{ padding: '9px 10px', textAlign: 'center', color: 'var(--muted)', fontSize: 12, fontFamily: v.unit ? '"IBM Plex Mono",monospace' : 'inherit' }}>
                          {v.unit || '—'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        )}

        {/* Review footnote */}
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 7, border: '1px solid var(--border)' }}>
          {lang === 'th'
            ? 'ทบทวนโดยองค์กรแพทย์และคณะอนุกรรมการมาตรฐาน IPSG 2 เมื่อวันที่ 2 พ.ย. 2565 — (—) หมายถึง ไม่มีค่าวิกฤติ'
            : 'Reviewed by Medical Staff Council & IPSG-2 sub-committee on 2 Nov 2022. (—) = no critical threshold defined.'}
        </div>
      </Section>
    </>
  )
}
