'use client'

import { useState, useEffect, useRef } from 'react'
import { Icon } from '@/components/ui/Icon'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import type { KpiSatisfaction } from '@/lib/supabase/types'

interface Props {
  canEdit: boolean
  addOpen?: boolean
  onAddClose?: () => void
}

// default metric order for display
const DEFAULT_ORDER = ['outpatient', 'inpatient', 'donor']

function passColor(val: number | null, target: number): 'green' | 'red' | 'none' {
  if (val === null) return 'none'
  return val >= target ? 'green' : 'red'
}

type ModalTab = 'metric' | 'year'

export function KpiSatisfactionPanel({ canEdit, addOpen = false, onAddClose }: Props) {
  const [data, setData] = useState<KpiSatisfaction[]>([])
  const [loading, setLoading] = useState(true)
  const [editCell, setEditCell] = useState<{ code: string; year: number } | null>(null)
  const [editVal, setEditVal] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // modal
  const [modalTab, setModalTab] = useState<ModalTab>('metric')
  const [metricName, setMetricName] = useState('')
  const [metricTarget, setMetricTarget] = useState('80')
  const [newYear, setNewYear] = useState(getCurrentThaiFiscalYear() + 1)
  const [modalSaving, setModalSaving] = useState(false)
  const [modalErr, setModalErr] = useState('')

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

  useEffect(() => {
    if (addOpen) { setModalTab('metric'); setMetricName(''); setMetricTarget('80'); setModalErr('') }
  }, [addOpen])

  // derive unique metrics from data (preserve default order, append new ones)
  const metrics = (() => {
    const seen = new Map<string, string>() // code → name
    for (const d of data) seen.set(d.metric_code, d.metric_name)
    const ordered: { code: string; name: string }[] = []
    for (const code of DEFAULT_ORDER) {
      if (seen.has(code)) ordered.push({ code, name: seen.get(code)! })
    }
    for (const [code, name] of seen) {
      if (!DEFAULT_ORDER.includes(code)) ordered.push({ code, name })
    }
    return ordered
  })()

  // derive unique years (data years + current year)
  const years = [...new Set([...data.map(d => d.fiscal_year), getCurrentThaiFiscalYear()])].sort()

  const existingYears = new Set(years)

  function getVal(code: string, year: number): KpiSatisfaction | undefined {
    return data.find(d => d.metric_code === code && d.fiscal_year === year)
  }

  async function handleCellSave() {
    if (!editCell) return
    setSaving(true)
    try {
      const metric = metrics.find(m => m.code === editCell.code)
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
          return idx >= 0 ? prev.map((d, i) => i === idx ? saved : d) : [...prev, saved]
        })
      }
    } finally { setSaving(false); setEditCell(null) }
  }

  async function handleAddMetric() {
    if (!metricName.trim()) { setModalErr('กรุณากรอกชื่อตัวชี้วัด'); return }
    const code = metricName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    if (!code) { setModalErr('ชื่อต้องมีตัวอักษรภาษาอังกฤษหรือตัวเลข'); return }
    if (metrics.some(m => m.code === code)) { setModalErr('ตัวชี้วัดนี้มีอยู่แล้ว'); return }
    const target = parseFloat(metricTarget) || 80
    setModalSaving(true); setModalErr('')
    try {
      // insert null entries for all existing years so column appears
      const results: KpiSatisfaction[] = []
      for (const y of years) {
        const res = await fetch('/kpi/api/satisfaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric_code: code, metric_name: metricName.trim(), fiscal_year: y, value: null, target_val: target }),
        })
        if (res.ok) results.push(await res.json())
      }
      setData(prev => {
        let next = [...prev]
        for (const r of results) {
          const idx = next.findIndex(d => d.metric_code === r.metric_code && d.fiscal_year === r.fiscal_year)
          next = idx >= 0 ? next.map((d, i) => i === idx ? r : d) : [...next, r]
        }
        return next
      })
      onAddClose?.()
    } finally { setModalSaving(false) }
  }

  async function handleAddYear() {
    setModalSaving(true); setModalErr('')
    try {
      const results: KpiSatisfaction[] = []
      for (const m of metrics) {
        const res = await fetch('/kpi/api/satisfaction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ metric_code: m.code, metric_name: m.name, fiscal_year: newYear, value: null }),
        })
        if (res.ok) results.push(await res.json())
      }
      setData(prev => {
        let next = [...prev]
        for (const r of results) {
          const idx = next.findIndex(d => d.metric_code === r.metric_code && d.fiscal_year === r.fiscal_year)
          next = idx >= 0 ? next.map((d, i) => i === idx ? r : d) : [...next, r]
        }
        return next
      })
      onAddClose?.()
    } finally { setModalSaving(false) }
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} style={{ height: 44, borderRadius: 8, background: 'var(--surface-2)' }} />
      ))}
    </div>
  )

  const thStyle: React.CSSProperties = {
    padding: '9px 16px', fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    textAlign: 'center', background: 'var(--surface-2)', borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap', letterSpacing: .5,
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
    fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
    outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
  }
  const tabBtn = (id: ModalTab, label: string) => (
    <button
      onClick={() => { setModalTab(id); setModalErr('') }}
      style={{
        flex: 1, padding: '8px 12px', border: 'none', borderRadius: 7, cursor: 'pointer',
        fontFamily: 'inherit', fontSize: 13, fontWeight: modalTab === id ? 700 : 500,
        background: modalTab === id ? 'var(--primary)' : 'transparent',
        color: modalTab === id ? '#fff' : 'var(--muted)',
        transition: 'all .15s',
      }}
    >{label}</button>
  )

  return (
    <>
      {/* ── Add Modal ────────────────────────────────────────────── */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 460, boxShadow: '0 20px 60px rgba(0,0,0,.25)', display: 'flex', flexDirection: 'column' }}>
            {/* header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>เพิ่มข้อมูลความพึงพอใจ</div>
              <button onClick={onAddClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><Icon name="x" size={18} /></button>
            </div>

            {/* tab switcher */}
            <div style={{ padding: '12px 24px 0', display: 'flex', gap: 4, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
              {tabBtn('metric', '+ ตัวชี้วัดใหม่')}
              {tabBtn('year',   '+ ปีงบประมาณ')}
            </div>

            {/* body */}
            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {modalErr && (
                <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(220,38,38,.08)', color: 'var(--danger)', fontSize: 13 }}>{modalErr}</div>
              )}

              {modalTab === 'metric' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    เพิ่มตัวชี้วัดใหม่ในตารางความพึงพอใจ — คอลัมน์จะขยายตามปีที่มีอยู่
                  </div>
                  <div>
                    <label style={labelStyle}>ชื่อตัวชี้วัด <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      style={inputStyle} value={metricName}
                      onChange={e => setMetricName(e.target.value)}
                      placeholder="เช่น ผู้รับบริการห้องปฏิบัติการ"
                      autoFocus
                    />
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
                      Metric code จะสร้างจากชื่อโดยอัตโนมัติ
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>เป้าหมาย (%)</label>
                    <div style={{ position: 'relative' }}>
                      <input type="number" style={{ ...inputStyle, paddingRight: 32 }} value={metricTarget} onChange={e => setMetricTarget(e.target.value)} min="0" max="100" step="0.01" />
                      <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--muted)' }}>%</span>
                    </div>
                  </div>
                </>
              )}

              {modalTab === 'year' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    เพิ่มปีงบประมาณใหม่ในตาราง — คอลัมน์จะขยาย พร้อมกรอกค่าภายหลังได้
                  </div>
                  <div>
                    <label style={labelStyle}>ปีงบประมาณ (พ.ศ.) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input
                      type="number" style={inputStyle} value={newYear}
                      onChange={e => setNewYear(Number(e.target.value))}
                      min="2560" max="2999" step="1"
                      placeholder="เช่น 2575"
                    />
                    {existingYears.has(newYear) ? (
                      <div style={{ fontSize: 11, color: 'var(--warning)', marginTop: 4 }}>⚠ ปีงบ {newYear} มีอยู่ในตารางแล้ว — จะอัปเดตค่าที่ว่างอยู่เท่านั้น</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>จะเพิ่มคอลัมน์ให้ {metrics.length} ตัวชี้วัด (ค่าเริ่มต้นว่าง)</div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={onAddClose} style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--ink)' }}>ยกเลิก</button>
              <button
                onClick={modalTab === 'metric' ? handleAddMetric : handleAddYear}
                disabled={modalSaving}
                style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: modalSaving ? 'not-allowed' : 'pointer', opacity: modalSaving ? 0.7 : 1 }}
              >
                {modalSaving ? 'กำลังบันทึก...' : modalTab === 'metric' ? 'เพิ่มตัวชี้วัด' : 'เพิ่มปีงบประมาณ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          <Icon name="shieldCheck" size={14} />
          อัตราความพึงพอใจของผู้ใช้บริการ (ผู้ป่วยนอก, ผู้ป่วยใน, ผู้รับบริจาคโลหิต) · เป้าหมาย &gt;80%
          {canEdit && <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--primary)' }}>· คลิกค่าที่ต้องการแก้ไข</span>}
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
              {metrics.map(metric => (
                <tr key={metric.code} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
                    {metric.name}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    &gt;{getVal(metric.code, years[0])?.target_val ?? 80}%
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
                              ref={inputRef} type="number" step="0.01" value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') handleCellSave(); if (e.key === 'Escape') setEditCell(null) }}
                              style={{ width: 70, padding: '5px 7px', borderRadius: 6, border: '1px solid var(--primary)', fontSize: 12, fontFamily: 'inherit', textAlign: 'right', outline: 'none' }}
                            />
                            <button onClick={handleCellSave} disabled={saving} style={{ width: 24, height: 24, borderRadius: 5, border: 'none', background: 'var(--primary)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
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
                        onClick={() => { if (!canEdit) return; setEditCell({ code: metric.code, year }); setEditVal(val !== null ? String(val) : '') }}
                        style={{
                          padding: '10px 16px', textAlign: 'center', fontWeight: val !== null ? 700 : 400,
                          color: color === 'green' ? 'var(--success)' : color === 'red' ? 'var(--danger)' : 'var(--muted)',
                          background: color === 'green' ? 'rgba(22,163,74,.08)' : color === 'red' ? 'rgba(220,38,38,.08)' : 'transparent',
                          cursor: canEdit ? 'pointer' : 'default', transition: 'background .1s', whiteSpace: 'nowrap',
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
    </>
  )
}
