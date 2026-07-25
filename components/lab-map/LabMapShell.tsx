'use client'

import { useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LabMapCanvas } from './LabMapCanvas'
import { LabMapStyles } from './LabMapStyles'
import type { LabMapDTO, MapMode } from '@/lib/lab-map/types'

const MODE_LABELS: Record<MapMode, { th: string; en: string }> = {
  overview: { th: 'พื้นที่และหน่วยงาน', en: 'Overview' },
  infection: { th: 'เขตควบคุมการติดเชื้อ', en: 'Infection control' },
  safety: { th: 'ความปลอดภัย', en: 'Safety' },
  personnel: { th: 'บุคลากร', en: 'Personnel' },
}

export interface LabMapShellProps {
  map: LabMapDTO
  allowedModes: readonly MapMode[]
  initialMode?: MapMode
  initialSelectedCode?: string | null
  initialRouteCode?: string | null
  heading?: string
  description?: string
  eyebrow?: string
  renderDetail?: (selectedCode: string | null, map: LabMapDTO) => ReactNode
}

export function LabMapShell({
  map,
  allowedModes,
  initialMode,
  initialSelectedCode = null,
  initialRouteCode = null,
  heading = 'แผนที่ห้องปฏิบัติการ',
  description = 'เลือกพื้นที่บนแผนที่หรือค้นหาจากชื่อห้องและหน่วยงาน',
  eyebrow = 'อาคารเฉลิมราชสมบัติ · ชั้น 3',
  renderDetail,
}: LabMapShellProps) {
  const defaultMode = initialMode && allowedModes.includes(initialMode) ? initialMode : allowedModes[0] ?? 'overview'
  const [mode, setMode] = useState<MapMode>(defaultMode)
  const [selectedCode, setSelectedCode] = useState<string | null>(initialSelectedCode)
  const [activeRouteCode, setActiveRouteCode] = useState<string | null>(initialRouteCode)
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const normalizedQuery = query.trim().toLocaleLowerCase('th')
  const results = useMemo(() => {
    if (!normalizedQuery) return []
    const spaces = map.spaces
      .filter((space) => `${space.nameTh} ${space.nameEn ?? ''} ${space.workUnits.join(' ')}`.toLocaleLowerCase('th').includes(normalizedQuery))
      .map((space) => ({ code: space.code, label: space.nameTh, type: 'ห้อง/พื้นที่' }))
    const zones = map.zones
      .filter((zone) => `${zone.nameTh} ${zone.workUnits.join(' ')}`.toLocaleLowerCase('th').includes(normalizedQuery))
      .map((zone) => ({ code: zone.code, label: zone.nameTh, type: 'โซน' }))
    return [...spaces, ...zones].slice(0, 8)
  }, [map.spaces, map.zones, normalizedQuery])

  const selectedSpace = map.spaces.find((space) => space.code === selectedCode) ?? null
  const selectedZone = map.zones.find((zone) => zone.code === selectedCode) ?? null
  const highlightedSpaceCodes = selectedZone?.spaceCodes ?? []

  function selectResult(code: string) {
    setSelectedCode(code)
    setQuery('')
    const visitorRoute = map.routes.find((route) => route.kind === 'visitor' && route.destinationCode === code)
    if (visitorRoute) setActiveRouteCode(visitorRoute.code)
  }

  function closeDetail() {
    setSelectedCode(null)
    setActiveRouteCode(null)
    searchRef.current?.focus()
  }

  const defaultDetail = selectedSpace ? (
    <>
      <p className="lab-map-detail-type">ห้อง / พื้นที่</p>
      <h2>{selectedSpace.nameTh}</h2>
      {selectedSpace.nameEn ? <p className="lab-map-detail-en">{selectedSpace.nameEn}</p> : null}
      {selectedSpace.workUnits.length ? (
        <div className="lab-map-detail-block">
          <span>หน่วยงานที่เกี่ยวข้อง</span>
          <ul>{selectedSpace.workUnits.map((unit) => <li key={unit}>{unit}</li>)}</ul>
        </div>
      ) : null}
      <p className="lab-map-access-note">{selectedSpace.controlled ? 'พื้นที่ควบคุม — ติดต่อเจ้าหน้าที่ก่อนเข้า' : 'พื้นที่สนับสนุนภายในชั้น 3'}</p>
    </>
  ) : selectedZone ? (
    <>
      <p className="lab-map-detail-type">โซน</p>
      <h2>{selectedZone.nameTh}</h2>
      <div className="lab-map-detail-block">
        <span>ประกอบด้วย</span>
        <ul>
          {selectedZone.spaceCodes.map((code) => (
            <li key={code}>{map.spaces.find((space) => space.code === code)?.nameTh ?? code}</li>
          ))}
        </ul>
      </div>
    </>
  ) : (
    <div className="lab-map-empty-detail">
      <span aria-hidden="true">⌖</span>
      <h2>เลือกพื้นที่เพื่อดูรายละเอียด</h2>
      <p>ใช้ช่องค้นหาหรือแตะห้องบนแผนที่ ข้อมูลจะเปิดในแผงนี้</p>
    </div>
  )

  return (
    <div className="lab-map-shell">
      <LabMapStyles />
      <header className="lab-map-header">
        <div>
          <p className="lab-map-eyebrow"><span aria-hidden="true" />{eyebrow}</p>
          <h1>{heading}</h1>
          <p>{description}</p>
        </div>
        <div className="lab-map-version" aria-label={`เวอร์ชัน ${map.version}`}>
          <span>MAP VERSION</span>
          <strong>{map.version}</strong>
        </div>
      </header>

      <div className="lab-map-toolbar">
        <div className="lab-map-mode-tabs" aria-label="เลือกมุมมองแผนที่">
          {allowedModes.map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              aria-pressed={mode === candidateMode}
              onClick={() => setMode(candidateMode)}
            >
              <span>{MODE_LABELS[candidateMode].th}</span>
              <small>{MODE_LABELS[candidateMode].en}</small>
            </button>
          ))}
        </div>

        <div className="lab-map-search-wrap">
          <label htmlFor="lab-map-search">ค้นหา</label>
          <div className="lab-map-search-field">
            <span aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              id="lab-map-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ชื่อห้อง โซน หรือหน่วยงาน"
              autoComplete="off"
              aria-controls="lab-map-search-results"
              aria-expanded={results.length > 0}
            />
          </div>
          {results.length > 0 ? (
            <ul id="lab-map-search-results" className="lab-map-search-results">
              {results.map((result) => (
                <li key={`${result.type}-${result.code}`}>
                  <button type="button" onClick={() => selectResult(result.code)}>
                    <span>{result.label}</span><small>{result.type}</small>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="lab-map-workspace">
        <LabMapCanvas
          map={map}
          mode={mode}
          selectedCode={selectedCode}
          activeRouteCode={activeRouteCode}
          highlightedSpaceCodes={highlightedSpaceCodes}
          onSelect={(code) => {
            setSelectedCode(code)
            setActiveRouteCode(null)
          }}
        />

        <aside
          className="lab-map-detail-panel"
          data-open={selectedCode !== null || undefined}
          role="dialog"
          aria-modal={false}
          aria-label="รายละเอียดพื้นที่"
        >
          {selectedCode ? <button className="lab-map-detail-close" type="button" onClick={closeDetail} aria-label="ปิดรายละเอียด">×</button> : null}
          {renderDetail ? renderDetail(selectedCode, map) : defaultDetail}
        </aside>
      </div>

      {mode === 'infection' ? (
        <div className="lab-map-legend" aria-label="คำอธิบายเขตควบคุมการติดเชื้อ">
          <span><i data-class="infectious" />พื้นที่ติดเชื้อ</span>
          <span><i data-class="clean" />พื้นที่สะอาด</span>
          <span><i data-class="risk" />พื้นที่เสี่ยง</span>
        </div>
      ) : null}
    </div>
  )
}
