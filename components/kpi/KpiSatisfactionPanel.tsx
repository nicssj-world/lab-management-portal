'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { KpiSatisfaction } from '@/lib/supabase/types'

interface Props {
  canEdit: boolean
}

const METRICS = [
  { code: 'outpatient', name: 'ผู้ป่วยนอก' },
  { code: 'inpatient',  name: 'ผู้ป่วยใน' },
  { code: 'donor',      name: 'ผู้รับบริจาคโลหิต' },
]

function passColor(val: number | null, target: number): 'green' | 'red' | 'none' {
  if (val === null) return 'none'
  return val >= target ? 'green' : 'red'
}

export function KpiSatisfactionPanel({ canEdit }: Props) {
  const [data, setData] = useState<KpiSatisfaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editCell, setEditCell] = useState<{ code: string; year: number } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/kpi/api/satisfaction')
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (editCell) setTimeout(() => inputRef.current?.focus(), 50)
  }, [editCell])

  // Collect all years present + current year
  const currentYear = new Date().getFullYear() + 543
  const yearsSet = new Set<number>([...data.map(d => d.fiscal_year), currentYear])
  const years = [...yearsSet].sort()

  function getVal(code: string, year: number): KpiSatisfaction | undefined {
    return data.find(d => d.metric_code === code && d.fiscal_year === year)
  }

  async function handleSave() {
    if (!editCell) return
    setSaving(true)
    try {
      const metric = METRICS.find(m => m.code === editCell.code)
      const res = await fetch('/kpi/api/satisfaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric_code: editCell.code,
          metric_name: metric?.name ?? editCell.code,
          fiscal_year: editCell.year,
          value: editVal === '' ? null : parseFloat(editVal),
        }),
      })
      const saved = await res.json()
      if (res.ok) {
        setData(prev => {
          const idx = prev.findIndex(d => d.metric_code === editCell.code && d.fiscal_year === editCell.year)
          if (idx >= 0) return prev.map((d, i) => i === idx ? saved : d)
          return [...prev, saved]
        })
      }
    } finally {
      setSaving(false)
      setEditCell(null)
    }
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด...</div>
  )

  const thStyle: React.CSSProperties = {
    padding: '9px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textAlign: 'center', background: 'var(--surface-2)', borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap', letterSpacing: .5,
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
        อัตราความพึงพอใจของผู้ใช้บริการ (ผู้ป่วยนอก, ผู้ป่วยใน, ผู้รับบริจาคโลหิต) · เป้าหมาย &gt;80%
        {canEdit && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--primary)' }}>คลิกค่าที่ต้องการแก้ไข</span>}
      </div>

      <div style={{ overflowX: 'auto', borderRadius: 10, border: '1px solid var(--border)' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left', minWidth: 200 }}>ตัวชี้วัด</th>
              <th style={{ ...thStyle, minWidth: 60 }}>Target</th>
              {years.map(y => (
                <th key={y} style={{ ...thStyle, minWidth: 80 }}>ปีงบ {y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map(metric => (
              <tr key={metric.code} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                  {metric.name}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                  &gt;80%
                </td>
                {years.map(year => {
                  const entry = getVal(metric.code, year)
                  const val = entry?.value ?? null
                  const target = entry?.target_val ?? 80
                  const color = passColor(val, target)
                  const isEditing = editCell?.code === metric.code && editCell?.year === year

                  if (isEditing) {
                    return (
                      <td key={year} style={{ padding: '6px 10px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center' }}>
                          <input
                            ref={inputRef}
                            type="number"
                            step="0.01"
                            value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditCell(null) }}
                            style={{ width: 70, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--primary)', fontSize: 12, fontFamily: 'inherit', textAlign: 'right', outline: 'none' }}
                          />
                          <button onClick={handleSave} disabled={saving} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon name="check" size={12} stroke={2.5} />
                          </button>
                          <button onClick={() => setEditCell(null)} style={{ width: 24, height: 24, borderRadius: 5, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--muted)' }}>
                            <Icon name="x" size={12} />
                          </button>
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={year}
                      onClick={() => {
                        if (!canEdit) return
                        setEditCell({ code: metric.code, year })
                        setEditVal(val !== null ? String(val) : '')
                      }}
                      style={{
                        padding: '10px 16px', textAlign: 'center', fontWeight: val !== null ? 700 : 400,
                        color: color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--danger)' : 'var(--muted)',
                        background: color === 'green' ? 'rgba(22,163,74,.08)' : color === 'red' ? 'rgba(220,38,38,.08)' : 'transparent',
                        cursor: canEdit ? 'pointer' : 'default',
                        transition: 'background .1s',
                        whiteSpace: 'nowrap',
                      }}
                      title={canEdit ? 'คลิกเพื่อแก้ไข' : undefined}
                    >
                      {val !== null ? `${val.toFixed(2)}%` : <span style={{ color: 'var(--border)', fontSize: 16 }}>—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
