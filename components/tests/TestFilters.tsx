'use client'

import { useRef } from 'react'
import { Input } from '@/components/ui/Input'
import type { Category } from '@/lib/supabase/types'

interface Props {
  search: string
  onSearch: (v: string) => void
  categoryId: string
  onCategoryChange: (v: string) => void
  tube: string
  onTubeChange: (v: string) => void
  categories: Category[]
  total: number
  filtered: number
}

const TUBE_OPTIONS = [
  'Sodium citrate (ฟ้า)',
  'Clotted blood (แดง)',
  'Lithium heparin (เขียว)',
  'EDTA (ม่วง)',
  'NaF (เทา)',
  'Urine',
  'Stool',
  'Hemoculture aerobic (ผู้ใหญ่)',
  'Hemoculture aerobic (เด็ก)',
  'Hemoculture fungi/TB',
  'Blood gas syringe',
  'Blood gas capillary tube',
  'Cowin tube',
  'Random urine',
  'อื่นๆ',
]

export function TestFilters({ search, onSearch, categoryId, onCategoryChange, tube, onTubeChange, categories, total, filtered }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const isFiltered = filtered !== total || !!search || !!categoryId || !!tube

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <style>{`
        @media (max-width: 767px) {
          .test-filter-row {
            display: grid !important;
            grid-template-columns: 1fr auto;
            gap: 8px;
          }
          .test-filter-search {
            grid-column: 1 / -1;
          }
          .test-filter-select {
            min-width: 0 !important;
            width: 100%;
          }
        }
      `}</style>

      {/* Row 1: Search + Specimen + Count badge */}
      <div className="test-filter-row" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="test-filter-search" style={{ flex: 1, minWidth: 0 }}>
          <Input
            icon="search"
            size="lg"
            value={search}
            onChange={onSearch}
            placeholder="ค้นหาชื่อ test, รหัส, รหัสกรมบัญชีกลาง..."
          />
        </div>

        <select
          className="test-filter-select"
          value={tube}
          onChange={e => onTubeChange(e.target.value)}
          style={{
            height: 44, padding: '0 36px 0 12px', borderRadius: 10,
            border: `1.5px solid ${tube ? 'var(--primary)' : 'var(--border)'}`,
            fontSize: 13, fontFamily: 'inherit',
            color: tube ? 'var(--primary)' : 'var(--muted)',
            backgroundColor: tube ? 'var(--primary-soft)' : 'var(--card)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748B' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 12px center',
            cursor: 'pointer', outline: 'none',
            minWidth: 170, fontWeight: tube ? 600 : 400,
            appearance: 'none',
          }}
        >
          <option value="">ทุก specimen</option>
          {TUBE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>

        {/* Result count chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '0 16px', height: 44, borderRadius: 10,
          background: isFiltered ? 'var(--primary-soft)' : 'var(--surface-2)',
          border: `1.5px solid ${isFiltered ? 'rgba(30,95,173,.25)' : 'var(--border)'}`,
          whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: isFiltered ? 'var(--primary)' : 'var(--ink)', lineHeight: 1 }}>
            {filtered.toLocaleString()}
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>รายการ</span>
        </div>
      </div>

      {/* Row 2: Category pills */}
      {categories.length > 0 && (
        <div
          ref={scrollRef}
          style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}
        >
          <style>{`.no-scrollbar::-webkit-scrollbar { display: none }`}</style>

          {/* "ทั้งหมด" pill */}
          <button
            onClick={() => onCategoryChange('')}
            style={{
              flexShrink: 0, padding: '5px 16px', borderRadius: 20, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 12.5, transition: 'all .15s',
              border: `1.5px solid ${!categoryId ? 'var(--primary)' : 'var(--border)'}`,
              background: !categoryId ? 'var(--primary)' : 'transparent',
              color: !categoryId ? '#fff' : 'var(--muted)',
              fontWeight: !categoryId ? 700 : 500,
            }}
          >
            ทั้งหมด
            {!categoryId && total > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: .8 }}>{total.toLocaleString()}</span>
            )}
          </button>

          {categories.map(cat => {
            const active = categoryId === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => onCategoryChange(active ? '' : cat.id)}
                style={{
                  flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12.5, transition: 'all .15s',
                  border: `1.5px solid ${active ? cat.color : 'var(--border)'}`,
                  background: active ? cat.color + '1a' : 'transparent',
                  color: active ? cat.color : 'var(--muted)',
                  fontWeight: active ? 700 : 500,
                }}
              >
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: cat.color,
                  opacity: active ? 1 : 0.5,
                  boxShadow: active ? `0 0 0 2px ${cat.color}33` : 'none',
                }} />
                {cat.th}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
