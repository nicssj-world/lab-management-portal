'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PublicSdsResult } from '@/lib/chemical-safety/public-types'
import type { GhsPictogramCode } from '@/lib/chemical-safety/types'
import { GhsPictogram } from './GhsPictogram'
import { SdsPdfViewerModal } from './SdsPdfViewerModal'

const GHS_CODES = Array.from({ length: 9 }, (_, index) => `GHS0${index + 1}`)
const ZONES = [
  { code: 'A', label: 'ตำแหน่ง A' },
  { code: 'B', label: 'ตำแหน่ง B' },
  { code: 'C', label: 'ตำแหน่ง C' },
  { code: 'T', label: 'ตำแหน่ง T (โต๊ะ)' },
]

export function PublicSdsLibrary({
  initialItems,
  initialQuery = '',
}: {
  initialItems: PublicSdsResult[]
  initialQuery?: string
}) {
  const [items, setItems] = useState(initialItems)
  const [q, setQ] = useState(initialQuery)
  const [unit, setUnit] = useState('')
  const [ghs, setGhs] = useState('')
  const [zone, setZone] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'limited'>('idle')
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null)

  const units = useMemo(
    () => [...new Map(initialItems.flatMap(item => item.units).map(item => [item.code, item])).values()],
    [initialItems],
  )

  useEffect(() => {
    setQ(initialQuery)
  }, [initialQuery])

  useEffect(() => {
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState('loading')
      const params = new URLSearchParams(location.search)
      if (q) params.set('q', q)
      else params.delete('q')
      if (unit) params.set('unit', unit)
      else params.delete('unit')
      if (ghs) params.set('ghs', ghs)
      else params.delete('ghs')
      if (zone) params.set('zone', zone)
      else params.delete('zone')
      history.replaceState(null, '', `${location.pathname}${params.size ? `?${params}` : ''}${location.hash}`)
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
  }, [q, unit, ghs, zone])

  return (
    <>
      <div className="sds-filter-panel">
        <label>
          <span>ค้นหาสารเคมี / Search</span>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ชื่อสาร ชื่อพ้อง CAS หรือผู้ผลิต" />
        </label>
        <label>
          <span>หน่วยงานที่รับผิดชอบ</span>
          <select value={unit} onChange={e => setUnit(e.target.value)}>
            <option value="">ทุกหน่วยงาน</option>
            {units.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
          </select>
        </label>
        <label>
          <span>ตำแหน่งจัดเก็บ</span>
          <select value={zone} onChange={e => setZone(e.target.value)}>
            <option value="">ทุกตำแหน่ง</option>
            {ZONES.map(item => <option key={item.code} value={item.code}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span>สัญลักษณ์ GHS</span>
          <select value={ghs} onChange={e => setGhs(e.target.value)}>
            <option value="">ทุกสัญลักษณ์</option>
            {GHS_CODES.map(code => <option key={code}>{code}</option>)}
          </select>
        </label>
      </div>

      {state === 'limited' && <p className="sds-state sds-error">มีคำขอมากเกินไป กรุณารอสักครู่</p>}
      {state === 'error' && <p className="sds-state sds-error">โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่</p>}

      {state === 'loading' ? (
        // จองพื้นที่ไว้ระหว่างโหลด เพื่อไม่ให้เนื้อหาด้านล่างกระโดด
        <div className="sds-card-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, index) => (
            <article className="sds-card sds-card-skeleton" key={index}>
              <div className="sds-skel" style={{ width: '60%', height: 22 }} />
              <div className="sds-skel" style={{ width: '38%', height: 14 }} />
              <div className="sds-skel" style={{ width: '100%', height: 58 }} />
              <div className="sds-skel" style={{ width: '45%', height: 40 }} />
            </article>
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="sds-state">ไม่พบสารเคมีที่ตรงกับเงื่อนไข</p>
      ) : (
        <div className="sds-card-grid">
          {items.map(item => (
            <article className="sds-card" key={item.publicId}>
              <div className="sds-card-head">
                <div>
                  <p className="sds-eyebrow">SAFETY DATA SHEET</p>
                  <h3>{item.canonicalName}</h3>
                  <p>
                    {item.casNumber ? `CAS ${item.casNumber}` : 'ไม่ระบุ CAS'}
                    {item.concentration ? ` · ${item.concentration}` : ''}
                  </p>
                </div>
                <span className={`sds-signal ${item.signalWord ? 'is-alert' : ''}`}>{item.signalWord || 'SDS'}</span>
              </div>

              <div className="sds-tag-row">
                <span className={`sds-tag ${item.sdsStatus === 'approved' ? 'is-ok' : 'is-wait'}`}>
                  {item.sdsStatus === 'approved' ? '✓ มีเอกสาร SDS' : '◌ ยังไม่มีเอกสาร SDS'}
                </span>
                {item.positionCode && <span className="sds-tag">ตู้ {item.positionCode}</span>}
                <span className="sds-tag" title={item.ghsSource === 'sds'
                  ? 'สัญลักษณ์มาจากเอกสาร SDS ฉบับที่ผ่านการทบทวนแล้ว'
                  : 'สัญลักษณ์แปลจากคอลัมน์ประเภทของสารเคมีในบัญชีรายการสารเคมี'}>
                  GHS {item.ghsSource === 'sds' ? 'จาก SDS' : 'จากบัญชีสารเคมี'}
                </span>
              </div>

              <dl>
                <div><dt>หน่วยงาน</dt><dd>{item.units.map(unitItem => unitItem.name).join(', ')}</dd></div>
                <div><dt>ผู้ผลิต / ภาษา</dt><dd>{item.manufacturer || '—'} · {item.language.toUpperCase()}</dd></div>
                <div><dt>ฉบับ / วันที่มีผล</dt><dd>{item.revisionLabel || '—'} · {item.effectiveOn || '—'}</dd></div>
              </dl>

              {item.pictogramCodes.length > 0 ? (
                <div className="sds-ghs-row">
                  {item.pictogramCodes.map(code => <GhsPictogram key={code} code={code as GhsPictogramCode} />)}
                </div>
              ) : item.hazardClassesTh.length > 0 ? (
                <p className="sds-hazard-text">{item.hazardClassesTh.join(' · ')} (ไม่มีสัญลักษณ์กำกับ)</p>
              ) : null}

              {item.hazardStatements.length > 0 && (
                <ul className="sds-hazards">
                  {item.hazardStatements.slice(0, 3).map(statement => (
                    <li key={statement.code}><b>{statement.code}</b> {statement.text}</li>
                  ))}
                </ul>
              )}

              {item.viewUrl && item.downloadUrl ? (
                <div className="sds-actions">
                  <button
                    type="button"
                    onClick={() => setPreview({ url: item.viewUrl!, title: item.canonicalName })}
                    aria-haspopup="dialog"
                  >
                    เปิด SDS
                  </button>
                  <a href={item.downloadUrl}>ดาวน์โหลด PDF</a>
                </div>
              ) : (
                <p className="sds-pending-note">
                  เอกสาร SDS ของสารนี้อยู่ระหว่างการทบทวน ข้อมูลการจำแนกอันตรายด้านบนใช้อ้างอิงได้
                  หากต้องการเอกสารฉบับเต็มกรุณาติดต่อกลุ่มงานเทคนิคการแพทย์
                </p>
              )}
            </article>
          ))}
        </div>
      )}
      {preview && (
        <SdsPdfViewerModal
          url={preview.url}
          title={preview.title}
          onClose={() => setPreview(null)}
        />
      )}
    </>
  )
}
