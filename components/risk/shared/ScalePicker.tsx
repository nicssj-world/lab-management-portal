'use client'

import { FONT, SPACE } from './tokens'

/**
 * เลือกคะแนน 1–5 พร้อมคำอธิบายกำกับ
 *
 * ระบบเดิมใช้ <select> ตัวเลขเปล่า ๆ ซึ่งทำให้แต่ละคนตีความ "3" ไม่ตรงกัน
 * การมีคำอธิบายอยู่ตรงหน้าตอนเลือกทำให้คะแนนจากคนละคนเทียบกันได้จริง
 */
export function ScalePicker({ legend, scale, value, onChange, name }: {
  legend: string
  scale: readonly { value: number; label: string; hint: string }[]
  value: number | null
  onChange: (value: number) => void
  name: string
}) {
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ fontSize: FONT.sm, fontWeight: 600, color: 'var(--muted)', marginBottom: 6 }}>{legend}</legend>
      <style>{`
        .risk-scale{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
        .risk-scale-option{display:flex;align-items:flex-start;gap:9px;min-height:44px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;cursor:pointer;transition:border-color .15s ease,background .15s ease}
        .risk-scale-option:hover{border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-scale-option[data-selected="true"]{border-color:var(--primary);background:var(--primary-soft)}
        .risk-scale-option:focus-within{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        @media(prefers-reduced-motion:reduce){.risk-scale-option{transition:none}}
      `}</style>
      <ul className="risk-scale">
        {scale.map(option => (
          <li key={option.value}>
            <label className="risk-scale-option" data-selected={value === option.value}>
              <input
                type="radio"
                name={name}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                style={{ marginTop: 3, accentColor: 'var(--primary)' }}
              />
              <span style={{ minWidth: 0 }}>
                <span style={{ fontSize: FONT.md, fontWeight: 600, color: 'var(--ink)' }}>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{option.value}</span> · {option.label}
                </span>
                <span style={{ display: 'block', fontSize: FONT.xs, color: 'var(--muted)', marginTop: 2 }}>{option.hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}

/** แสดงคะแนนและระดับที่คำนวณได้ทันทีที่เลือก เพื่อให้เห็นผลของการให้คะแนนโดยไม่ต้องบันทึกก่อน */
export function ScoreReadout({ label, likelihood, impact, level, tone }: {
  label: string
  likelihood: number | null
  impact: number | null
  level: string | null
  tone: string
}) {
  const score = likelihood && impact ? likelihood * impact : null
  return (
    <div style={{ padding: SPACE.sm, borderRadius: 10, background: 'var(--surface-2)', minWidth: 0 }}>
      <div style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: FONT.xl, fontWeight: 700, color: score ? tone : 'var(--muted)' }}>
          {score ?? '—'}
        </span>
        <span style={{ fontSize: FONT.md, fontWeight: 600, color: score ? tone : 'var(--muted)' }}>{level ?? 'ยังไม่ประเมิน'}</span>
      </div>
      <div style={{ fontSize: FONT.xs, color: 'var(--muted)', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        โอกาสเกิด {likelihood ?? '—'} × ผลกระทบ {impact ?? '—'}
      </div>
    </div>
  )
}
