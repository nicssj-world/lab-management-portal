'use client'

import { useState } from 'react'
import { RawTableView } from './ReferenceRangePaste'
import { decodeTable } from '@/lib/utils/refTable'
import { ReferenceRangeTable } from './ReferenceRangeTable'
import type { TestReferenceRange } from '@/lib/supabase/types'

interface Props {
  ranges?: TestReferenceRange[]
  tableJson?: string | null
  refNote?: string | null
}

export function RefRangeModal({ ranges = [], tableJson, refNote }: Props) {
  const [open, setOpen] = useState(false)
  const table = decodeTable(tableJson)
  if (ranges.length === 0 && table === null) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          border: '1px solid var(--border)', background: 'var(--surface-2)',
          color: 'var(--ink)', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        คลิก เพื่อดูค่าอ้างอิง
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--card)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 720, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,.2)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>ค่าอ้างอิง (Reference Range)</span>
              <button
                onClick={() => setOpen(false)}
                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 16, color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ×
              </button>
            </div>

            {ranges.length > 0
              ? <ReferenceRangeTable ranges={ranges} />
              : table
                ? <RawTableView table={table} />
                : null}

            {refNote && (
              <div style={{ display: 'flex', gap: 8, marginTop: 16, padding: '10px 14px', borderRadius: 8, background: 'var(--surface-2)', fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                <span>⚠</span>
                <span style={{ whiteSpace: 'pre-wrap' }}>{refNote}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
