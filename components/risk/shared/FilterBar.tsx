'use client'

import type { ReactNode } from 'react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { FONT, SPACE, THAI_MONTHS, fiscalYearOptions, inputStyle } from './tokens'
import { useDebouncedSearch } from './useUrlFilters'

/** แถบตัวกรองที่ใช้ร่วมกันทุกหน้ารายการ — ทุกช่องมีป้ายกำกับที่โปรแกรมอ่านหน้าจอเห็น */
export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        .risk-filter-bar{display:grid;grid-template-columns:minmax(200px,2fr) repeat(auto-fit,minmax(130px,1fr));gap:8px}
        @media(max-width:640px){.risk-filter-bar{grid-template-columns:1fr}}
      `}</style>
      <div className="risk-filter-bar">{children}</div>
    </>
  )
}

function LabelledControl({ label, children }: { label: string; children: (id: string) => ReactNode }) {
  const id = useId()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <label htmlFor={id} style={{ fontSize: FONT.xs, fontWeight: 600, color: 'var(--muted)', marginBottom: 4 }}>{label}</label>
      {children(id)}
    </div>
  )
}

export function SearchFilter({ value, placeholder, onCommit }: {
  value: string
  placeholder: string
  onCommit: (value: string) => void
}) {
  const [text, setText] = useDebouncedSearch(value, onCommit)
  return (
    <LabelledControl label="ค้นหา">
      {id => (
        <input
          id={id}
          type="search"
          value={text}
          placeholder={placeholder}
          onChange={e => setText(e.target.value)}
          style={inputStyle}
        />
      )}
    </LabelledControl>
  )
}

export function SelectFilter({ label, value, options, allLabel, onChange }: {
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  allLabel: string
  onChange: (value: string) => void
}) {
  return (
    <LabelledControl label={label}>
      {id => (
        <select id={id} value={value} onChange={e => onChange(e.target.value)} style={inputStyle}>
          <option value="">{allLabel}</option>
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </LabelledControl>
  )
}

export function FiscalYearFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SelectFilter
      label="ปีงบประมาณ"
      value={value}
      allLabel="ทุกปีงบ"
      options={fiscalYearOptions(value).map(y => ({ value: String(y), label: `ปีงบ ${y}` }))}
      onChange={onChange}
    />
  )
}

export function MonthFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <SelectFilter
      label="เดือน"
      value={value}
      allLabel="ทุกเดือน"
      options={THAI_MONTHS.map(m => ({ value: m.value, label: m.label }))}
      onChange={onChange}
    />
  )
}

/**
 * แถบบอกว่ากำลังกรองอะไรอยู่ พร้อมปุ่มล้าง
 *
 * จำเป็นเพราะตัวกรองบางตัวตั้งมาจากลิงก์หรือการกดช่องในตารางความเสี่ยง โดยไม่มีช่องควบคุม
 * บนหน้าจอให้ตั้งกลับ ถ้าไม่มีปุ่มนี้ผู้ใช้จะติดอยู่กับผลลัพธ์ที่แคบลงโดยไม่รู้สาเหตุ
 */
export function ActiveFilterBar({ count, detail, onClear }: {
  count: number
  detail?: string
  onClear: () => void
}) {
  if (count === 0) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap' }}>
      <p style={{ margin: 0, fontSize: FONT.base, color: 'var(--muted)' }}>
        {detail
          ? <>กรองอยู่: <strong style={{ color: 'var(--ink)' }}>{detail}</strong></>
          : `ใช้ตัวกรองอยู่ ${count} รายการ`}
      </p>
      <Button variant="secondary" size="sm" icon="x" onClick={onClear}>ล้างตัวกรองทั้งหมด</Button>
    </div>
  )
}

/** แถบเลื่อนหน้า — บอกช่วงที่กำลังดูเป็นข้อความ ไม่ใช่แค่เลขหน้า */
export function Pagination({ page, pageSize, count, onChange }: {
  page: number
  pageSize: number
  count: number
  onChange: (page: number) => void
}) {
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const safePage = Math.min(page, totalPages)
  const start = count === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(safePage * pageSize, count)

  return (
    <>
      <style>{`
        .risk-page-btn{display:inline-flex;align-items:center;min-height:44px;padding:6px 14px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:13px;font-weight:600;cursor:pointer;transition:border-color .15s ease}
        .risk-page-btn:hover:not(:disabled){border-color:color-mix(in srgb,var(--primary) 45%,var(--border))}
        .risk-page-btn:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .risk-page-btn:disabled{opacity:.45;cursor:not-allowed}
        @media(prefers-reduced-motion:reduce){.risk-page-btn{transition:none}}
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.xs, flexWrap: 'wrap' }}>
        <p style={{ margin: 0, color: 'var(--muted)', fontSize: FONT.base, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          แสดง {start.toLocaleString('th-TH')}–{end.toLocaleString('th-TH')} จาก {count.toLocaleString('th-TH')} รายการ
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
          <button type="button" className="risk-page-btn" disabled={safePage <= 1} onClick={() => onChange(safePage - 1)}>ก่อนหน้า</button>
          <span style={{ minWidth: 90, textAlign: 'center', color: 'var(--muted)', fontSize: FONT.base, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            หน้า {safePage} / {totalPages}
          </span>
          <button type="button" className="risk-page-btn" disabled={safePage >= totalPages} onClick={() => onChange(safePage + 1)}>ถัดไป</button>
        </div>
      </div>
    </>
  )
}
