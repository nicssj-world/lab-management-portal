'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PublicSdsResult } from '@/lib/chemical-safety/public-types'
import type { GhsPictogramCode } from '@/lib/chemical-safety/types'
import { GhsPictogram } from './GhsPictogram'

export function PublicSdsLibrary({ initialItems }: { initialItems: PublicSdsResult[] }) {
  const [items, setItems] = useState(initialItems)
  const [q, setQ] = useState('')
  const [unit, setUnit] = useState('')
  const [ghs, setGhs] = useState('')
  const [state, setState] = useState<'idle'|'loading'|'error'|'limited'>('idle')
  const units = useMemo(() => [...new Map(initialItems.flatMap(item => item.units).map(item => [item.code, item])).values()], [initialItems])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState('loading')
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (unit) params.set('unit', unit)
      if (ghs) params.set('ghs', ghs)
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}`)
      try {
        const response = await fetch(`/api/public/sds?${params}`, { signal: controller.signal })
        if (response.status === 429) { setState('limited'); return }
        if (!response.ok) throw new Error('request failed')
        const payload = await response.json()
        setItems(payload.items ?? [])
        setState('idle')
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setState('error')
      }
    }, 300)
    return () => { clearTimeout(timer); controller.abort() }
  }, [q, unit, ghs])

  return <>
    <div className="sds-filter-panel">
      <label><span>ค้นหาสารเคมี / Search</span><input value={q} onChange={e => setQ(e.target.value)} placeholder="ชื่อสาร, alias, CAS, ผู้ผลิต" /></label>
      <label><span>หน่วยงาน / Department</span><select value={unit} onChange={e => setUnit(e.target.value)}><option value="">ทุกหน่วยงาน</option>{units.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label><span>GHS</span><select value={ghs} onChange={e => setGhs(e.target.value)}><option value="">ทุกสัญลักษณ์</option>{Array.from({length: 9}, (_, i) => `GHS0${i + 1}`).map(code => <option key={code}>{code}</option>)}</select></label>
    </div>
    {state === 'loading' && <p className="sds-state">กำลังค้นหา…</p>}
    {state === 'limited' && <p className="sds-state sds-error">มีคำขอมากเกินไป กรุณารอสักครู่</p>}
    {state === 'error' && <p className="sds-state sds-error">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>}
    {state !== 'loading' && items.length === 0 && <p className="sds-state">ไม่พบ SDS ที่อนุมัติและใช้งานอยู่</p>}
    <div className="sds-card-grid">
      {items.map(item => <article className="sds-card" key={item.publicId}>
        <div className="sds-card-head"><div><p className="sds-eyebrow">SAFETY DATA SHEET</p><h2>{item.canonicalName}</h2><p>{item.casNumber ? `CAS ${item.casNumber}` : 'ไม่ระบุ CAS'}{item.concentration ? ` · ${item.concentration}` : ''}</p></div><span className={`sds-signal ${item.signalWord ? 'is-alert' : ''}`}>{item.signalWord || 'SDS'}</span></div>
        <dl><div><dt>หน่วยงาน</dt><dd>{item.units.map(unit => unit.name).join(', ')}</dd></div><div><dt>ผู้ผลิต / ภาษา</dt><dd>{item.manufacturer || '—'} · {item.language.toUpperCase()}</dd></div><div><dt>ฉบับ / วันที่มีผล</dt><dd>{item.revisionLabel || '—'} · {item.effectiveOn || '—'}</dd></div></dl>
        {item.pictogramCodes.length > 0 && <div className="sds-ghs-row">{item.pictogramCodes.map(code => <GhsPictogram key={code} code={code as GhsPictogramCode} />)}</div>}
        {item.hazardStatements.length > 0 && <ul className="sds-hazards">{item.hazardStatements.slice(0, 3).map(h => <li key={h.code}><b>{h.code}</b> {h.text}</li>)}</ul>}
        <div className="sds-actions"><a href={item.viewUrl} target="_blank" rel="noopener noreferrer">เปิด SDS</a><a href={item.downloadUrl}>ดาวน์โหลด PDF</a></div>
      </article>)}
    </div>
  </>
}
