'use client'

import { useMemo, useRef, useState } from 'react'
import { LabMapPrintSheet } from './LabMapPrintSheet'
import { exportMapAsPdf, exportMapAsPng } from '@/lib/lab-map/export-client'
import type { MapPrintDTO, MapPrintKind, MapPaperSize } from '@/lib/lab-map/print'

export function LabMapExportClient({ catalog }: { catalog: readonly MapPrintDTO[] }) {
  const [kind, setKind] = useState<MapPrintKind>('evacuation')
  const [paperSize, setPaperSize] = useState<MapPaperSize>('A3')
  const [stationCode, setStationCode] = useState('office')
  const [destinationCode, setDestinationCode] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  const sheetRef = useRef<HTMLDivElement>(null)
  const candidates = useMemo(() => catalog.filter((item) => item.kind === kind && item.paperSize === paperSize && item.map.stationCode === stationCode), [catalog, kind, paperSize, stationCode])
  const dto = candidates.find((item) => !destinationCode || item.map.routes.some((route) => route.destinationCode === destinationCode)) ?? candidates[0] ?? catalog[0]
  if (!dto) return <p>ยังไม่มีข้อมูลฉบับแผนที่สำหรับพิมพ์</p>

  // จุดติดตั้งแสดงชื่อไทยจาก installationPoint ของแคตตาล็อก แทนรหัสดิบ (เช่น 'office')
  const stationOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const item of catalog.filter((entry) => entry.kind === kind)) {
      if (!seen.has(item.map.stationCode)) seen.set(item.map.stationCode, item.installationPoint)
    }
    return [...seen.entries()]
  }, [catalog, kind])

  const destinations = kind === 'visitor_navigation'
    ? [...new Map(candidates.flatMap((item) => item.map.routes).map((route) => [route.destinationCode, route])).values()]
    : []
  const accessPointNameByCode = new Map(dto.map.accessPoints.map((point) => [point.code, point.nameTh]))

  async function run(type: 'pdf' | 'png') {
    const element = sheetRef.current?.querySelector<HTMLElement>('[data-map-print-sheet]')
    if (!element) return
    setExporting(true); setError('')
    try { if (type === 'pdf') await exportMapAsPdf(element, dto); else await exportMapAsPng(element, dto) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'ส่งออกไม่สำเร็จ') }
    finally { setExporting(false) }
  }

  return (
    <div className="lab-map-export">
      <style>{EXPORT_CSS}</style>
      <section className="lab-map-export-controls">
        <label>ชนิดแผนที่<select value={kind} onChange={(event) => { setKind(event.target.value as MapPrintKind); setDestinationCode(''); setStationCode('office') }}>
          <option value="evacuation">เส้นทางหนีไฟ</option><option value="infection_control">ควบคุมการติดเชื้อ</option><option value="visitor_navigation">นำทางผู้มาติดต่อ</option>
        </select></label>
        {kind !== 'infection_control' ? <label>จุดติดตั้ง<select value={stationCode} onChange={(event) => setStationCode(event.target.value)}>
          {stationOptions.map(([code, nameTh]) => <option key={code} value={code}>{nameTh}</option>)}
        </select></label> : null}
        {destinations.length ? <label>ปลายทาง<select value={destinationCode} onChange={(event) => setDestinationCode(event.target.value)}><option value="">ทุกปลายทาง</option>{destinations.map((route) => <option key={route.destinationCode} value={route.destinationCode}>{accessPointNameByCode.get(route.destinationCode) ?? route.destinationCode}</option>)}</select></label> : null}
        <label>กระดาษ<select value={paperSize} onChange={(event) => setPaperSize(event.target.value as MapPaperSize)}><option value="A3">A3 แนวนอน</option><option value="A4">A4 แนวนอน</option></select></label>
        <div className="lab-map-export-status"><strong>{dto.official ? 'ฉบับใช้งานจริง' : 'ตัวอย่างฉบับร่าง'}</strong><span>{dto.official ? dto.release.versionCode : 'ร่าง — ห้ามใช้ติดตั้ง'}</span></div>
        <button type="button" onClick={() => run('pdf')} disabled={!dto.official || exporting}>ส่งออกฉบับใช้งานจริง PDF</button>
        {!dto.official ? <button type="button" onClick={() => run('pdf')} disabled={exporting}>PDF ตัวอย่างพร้อมลายน้ำ</button> : null}
        <button type="button" onClick={() => run('png')} disabled={exporting}>PNG ความละเอียดสูง</button>
        {error ? <p role="alert">{error}</p> : null}
      </section>
      <div className="lab-map-export-preview" ref={sheetRef}><LabMapPrintSheet dto={dto} /></div>
    </div>
  )
}

const EXPORT_CSS = `.lab-map-export{display:grid;grid-template-columns:280px minmax(0,1fr);gap:18px}.lab-map-export-controls{display:grid;min-width:0;align-content:start;gap:12px;padding:18px;border:1px solid var(--border);border-radius:14px;background:var(--card)}.lab-map-export-controls label{display:grid;min-width:0;gap:5px;font-size:12px;font-weight:700}.lab-map-export-controls select{width:100%;min-width:0;box-sizing:border-box;min-height:42px;padding:7px 9px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);text-overflow:ellipsis}.lab-map-export-controls button{width:100%;min-width:0;box-sizing:border-box;min-height:44px;padding:9px 12px;border:0;border-radius:9px;background:#12324a;color:#fff;font:700 12px "Noto Sans Thai",sans-serif;white-space:normal;overflow-wrap:break-word;word-break:break-word;text-align:center}.lab-map-export-controls button:disabled{opacity:.45}.lab-map-export-status{display:grid;padding:10px;border-left:4px solid #f0b429;background:var(--surface-2);font-size:12px}.lab-map-export-preview{overflow:auto;padding:14px;background:#cdd9dc;border-radius:14px;max-height:78vh}@media(max-width:850px){.lab-map-export{grid-template-columns:1fr}.lab-map-export-preview{max-height:65vh}}`
