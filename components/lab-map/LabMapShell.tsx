'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { GoogleMapEmbed } from './GoogleMapEmbed'
import { LabMapCanvas } from './LabMapCanvas'
import { LabMapStyles } from './LabMapStyles'
import { SafetyEquipmentDetailDialog } from './SafetyEquipmentDetailDialog'
import { FilterChips } from '@/components/ui/FilterChips'
import { PageHeader } from '@/components/ui/PageHeader'
import { Icon } from '@/components/ui/Icon'
import type { LabMapDTO, MapMode, SafetyAssetDTO } from '@/lib/lab-map/types'

const MODE_LABELS: Record<MapMode, { th: string; icon: string }> = {
  overview: { th: 'พื้นที่และหน่วยงาน', icon: 'building' },
  infection: { th: 'เขตควบคุมการติดเชื้อ', icon: 'biohazard' },
  safety: { th: 'แผนผังทางหนีไฟ', icon: 'shield' },
  'safety-assets': { th: 'อุปกรณ์ความปลอดภัย', icon: 'shieldCheck' },
}

export interface LabMapShellProps {
  map: LabMapDTO
  allowedModes: readonly MapMode[]
  initialMode?: MapMode
  initialSelectedCode?: string | null
  initialRouteCode?: string | null
  destinationPointCode?: string | null
  /** สถานีความปลอดภัยเริ่มต้น — ไม่ระบุ = ใช้ map.stationCode (ค่าเริ่มต้นเดิม) */
  initialSafetyStationCode?: string
  /** จำกัดตัวเลือกสถานีความปลอดภัยที่แสดงให้สลับได้ — ไม่ระบุ = แสดงทุกสถานีในผัง */
  safetyStationCodes?: readonly string[]
  heading?: string
  description?: string
  eyebrow?: string
  compact?: boolean
  renderDetail?: (selectedCode: string | null, map: LabMapDTO) => ReactNode
  searchItems?: readonly { code: string; label: string; type: string; keywords?: string }[]
  highlightedCodesForSelection?: (selectedCode: string | null, map: LabMapDTO) => readonly string[]
  /** ปุ่ม/ลิงก์เพิ่มเติมในหัวเพจ วางไว้ข้าง badge เวอร์ชัน — ไม่ใช่ sibling แยกด้านบน (ทำให้หัวข้อไม่ชิดบน) */
  headerActions?: ReactNode
  /** แผนที่เจ้าหน้าที่เท่านั้น: กดถังดับเพลิงเพื่อดูผลตรวจและรูปหลักฐานล่าสุด */
  showSafetyInspectionDetails?: boolean
}

export function LabMapShell({
  map,
  allowedModes,
  initialMode,
  initialSelectedCode = null,
  initialRouteCode = null,
  destinationPointCode = null,
  initialSafetyStationCode,
  safetyStationCodes,
  heading = 'แผนที่ห้องปฏิบัติการ',
  description = 'เลือกพื้นที่บนแผนที่หรือค้นหาจากชื่อห้องและหน่วยงาน',
  eyebrow = 'อาคารเฉลิมราชสมบัติ · ชั้น 3',
  compact = false,
  renderDetail,
  searchItems = [],
  highlightedCodesForSelection,
  headerActions,
  showSafetyInspectionDetails = false,
}: LabMapShellProps) {
  const defaultMode = initialMode && allowedModes.includes(initialMode) ? initialMode : allowedModes[0] ?? 'overview'
  const [mode, setMode] = useState<MapMode>(defaultMode)
  const [selectedCode, setSelectedCode] = useState<string | null>(initialSelectedCode)
  const [activeRouteCode, setActiveRouteCode] = useState<string | null>(initialRouteCode)
  const defaultSafetyStation = initialSafetyStationCode ?? map.stationCode
  const [safetyStationCode, setSafetyStationCode] = useState(defaultSafetyStation)
  const [query, setQuery] = useState('')
  const [inspectionAsset, setInspectionAsset] = useState<SafetyAssetDTO | null>(null)
  const [inspectionLoading, setInspectionLoading] = useState(false)
  const [inspectionError, setInspectionError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMode(defaultMode), [defaultMode])
  useEffect(() => setActiveRouteCode(initialRouteCode), [initialRouteCode])
  useEffect(() => setSafetyStationCode(defaultSafetyStation), [defaultSafetyStation])

  /**
   * ผู้ใช้เลือก "จุดที่คุณอยู่" ได้เอง — ค่าเริ่มต้นตั้งตามตำแหน่งจริงที่ระบบทราบ
   * (จุดสแกนปลายทางของผู้มาติดต่อ หรือสถานีปัจจุบันของแผนที่ฝั่งเจ้าหน้าที่)
   * เพื่อให้เส้นทางหนีไฟที่แสดงตรงกับตำแหน่งที่ยืนอยู่จริง ไม่ใช่แผนของสำนักงานเสมอ
   */
  const stationPickerItems = useMemo(() => {
    const codes = safetyStationCodes ?? map.stations.map((station) => station.code)
    return codes
      .map((code) => map.stations.find((station) => station.code === code))
      .filter((station): station is NonNullable<typeof station> => station !== undefined)
      .map((station) => ({ value: station.code, label: station.nameTh }))
  }, [safetyStationCodes, map.stations])

  const evacuationRoutes = useMemo(
    () => map.routes.filter((route) => route.kind === 'evacuation' && route.fromStationCode === safetyStationCode),
    [map.routes, safetyStationCode],
  )
  const primaryEvacuation = evacuationRoutes.find((route) => route.variant === 'primary') ?? null
  const alternateEvacuation = evacuationRoutes.find((route) => route.variant === 'alternate') ?? null
  const relevantAssemblyPoints = useMemo(() => {
    const exitCodes = new Set([primaryEvacuation?.destinationCode, alternateEvacuation?.destinationCode].filter(Boolean))
    return map.assemblyPoints.filter((assembly) => assembly.exitCodes.some((code) => exitCodes.has(code)))
  }, [map.assemblyPoints, primaryEvacuation, alternateEvacuation])

  const activeRouteCodes = mode === 'safety'
    ? evacuationRoutes.map((route) => route.code)
    : activeRouteCode ? [activeRouteCode] : []

  const activeVisitorRoute = mode === 'safety'
    ? null
    : map.routes.find((route) => route.code === activeRouteCode) ?? null

  const normalizedQuery = query.trim().toLocaleLowerCase('th')
  const results = useMemo(() => {
    if (!normalizedQuery) return []
    const spaces = map.spaces
      .filter((space) => `${space.nameTh} ${space.nameEn ?? ''} ${space.workUnits.join(' ')}`.toLocaleLowerCase('th').includes(normalizedQuery))
      .map((space) => ({ code: space.code, label: space.nameTh, type: 'ห้อง/พื้นที่' }))
    const zones = map.zones
      .filter((zone) => `${zone.nameTh} ${zone.workUnits.join(' ')}`.toLocaleLowerCase('th').includes(normalizedQuery))
      .map((zone) => ({ code: zone.code, label: zone.nameTh, type: 'โซน' }))
    const extras = searchItems.filter((item) =>
      `${item.label} ${item.keywords ?? ''}`.toLocaleLowerCase('th').includes(normalizedQuery),
    )
    return [...spaces, ...zones, ...extras].slice(0, 10)
  }, [map.spaces, map.zones, normalizedQuery, searchItems])

  const selectedSpace = map.spaces.find((space) => space.code === selectedCode) ?? null
  const selectedZone = map.zones.find((zone) => zone.code === selectedCode) ?? null
  const highlightedSpaceCodes = highlightedCodesForSelection?.(selectedCode, map)
    ?? selectedZone?.spaceCodes
    ?? []
  const selectedExtinguisher = mode === 'safety' && showSafetyInspectionDetails
    ? map.safetyEquipment.find((item) => item.code === selectedCode && item.kind === 'fire-extinguisher') ?? null
    : null

  useEffect(() => {
    if (!selectedExtinguisher) {
      setInspectionAsset(null)
      setInspectionLoading(false)
      setInspectionError(null)
      return undefined
    }
    const controller = new AbortController()
    setInspectionAsset(null)
    setInspectionLoading(true)
    setInspectionError(null)
    void fetch(`/api/admin/lab-map/safety-assets?code=${encodeURIComponent(selectedExtinguisher.code)}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({})) as { items?: SafetyAssetDTO[]; error?: string }
        if (!response.ok) throw new Error(payload.error ?? 'ไม่สามารถโหลดรายละเอียดถังดับเพลิงได้')
        if (!payload.items?.[0]) throw new Error('ไม่พบทะเบียนถังดับเพลิงนี้')
        return payload.items[0]
      })
      .then((asset) => { if (!controller.signal.aborted) setInspectionAsset(asset) })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setInspectionError(error instanceof Error ? error.message : 'ไม่สามารถโหลดรายละเอียดถังดับเพลิงได้')
      })
      .finally(() => { if (!controller.signal.aborted) setInspectionLoading(false) })
    return () => controller.abort()
  }, [selectedExtinguisher])

  function selectResult(code: string) {
    setSelectedCode(code)
    setQuery('')
  }

  function closeDetail() {
    setSelectedCode(null)
    searchRef.current?.focus()
  }

  function selectMapItem(code: string) {
    setSelectedCode(code)
  }

  function changeMode(candidateMode: MapMode) {
    setMode(candidateMode)
    if (candidateMode !== 'safety') setSelectedCode(null)
  }

  async function copyAssemblyCoordinates(latitude: number, longitude: number) {
    await navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`)
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

  const safetyDetail = (
    <div className="lab-map-safety-panel">
      <p className="lab-map-detail-type">เส้นทางหนีไฟ</p>
      <h2>{map.stations.find((station) => station.code === safetyStationCode)?.nameTh ?? 'จุดติดตั้งแผนที่'}</h2>
      {primaryEvacuation ? (
        <div className="lab-map-detail-block">
          <span>เส้นทางหลัก</span>
          <ol>{primaryEvacuation.directionsTh.map((step, index) => <li key={`p-${index}`}>{step}</li>)}</ol>
        </div>
      ) : null}
      {alternateEvacuation ? (
        <div className="lab-map-detail-block">
          <span>เส้นทางสำรอง</span>
          <ol>{alternateEvacuation.directionsTh.map((step, index) => <li key={`a-${index}`}>{step}</li>)}</ol>
        </div>
      ) : null}
      {!primaryEvacuation && !alternateEvacuation ? (
        <p className="lab-map-safety-missing" role="status">
          ยังไม่มีเส้นทางหนีไฟที่อนุมัติสำหรับจุดนี้ — กรุณาเดินตามป้ายทางหนีไฟจริงภายในอาคาร
          และแจ้งเจ้าหน้าที่ความปลอดภัยของกลุ่มงาน
        </p>
      ) : null}
      {relevantAssemblyPoints.length > 0 ? (
        <div className="lab-map-assembly-note lab-map-assembly-list">
          <strong>จุดรวมพล/จุดปลอดภัย</strong>
          {relevantAssemblyPoints.map((assembly) => (
            <section className="lab-map-assembly-card" key={assembly.code}>
              <h3>{assembly.pointType === 'safe' ? 'จุดปลอดภัย' : 'จุดรวมพล'} · {assembly.nameTh}</h3>
              {assembly.detailTh ? <p>{assembly.detailTh}</p> : null}
              {assembly.latitude != null && assembly.longitude != null ? (
                <>
                  <code>{assembly.latitude.toFixed(6)}, {assembly.longitude.toFixed(6)}</code>
                  <GoogleMapEmbed latitude={assembly.latitude} longitude={assembly.longitude} nameTh={assembly.nameTh} />
                  <div className="lab-map-assembly-actions">
                    <button type="button" onClick={() => void copyAssemblyCoordinates(assembly.latitude!, assembly.longitude!)}>
                      คัดลอกพิกัด
                    </button>
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${assembly.latitude},${assembly.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      เปิด Google Maps
                    </a>
                  </div>
                </>
              ) : (
                <p className="lab-map-safety-missing">ยังไม่มีพิกัด GPS ที่เผยแพร่ โปรดใช้ชื่อและจุดสังเกตในการปฏิบัติงาน</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )

  return (
    <div className="lab-map-shell" data-compact={compact || undefined}>
      <LabMapStyles />
      <header className="lab-map-header">
        <PageHeader
          eyebrow={eyebrow}
          title={heading}
          subtitle={description}
          marginBottom={0}
          actions={(
            <>
              {headerActions}
              <div className="lab-map-version" aria-label={`เวอร์ชัน ${map.version}`}>
                <span>MAP VERSION</span>
                <strong>{map.version}</strong>
                {map.releaseStatus === 'draft' ? <em>ฉบับร่าง</em> : null}
              </div>
            </>
          )}
        />
      </header>

      <div className="lab-map-toolbar">
        <div className="lab-map-mode-tabs" aria-label="เลือกมุมมองแผนที่">
          {allowedModes.map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              aria-pressed={mode === candidateMode}
              onClick={() => changeMode(candidateMode)}
            >
              <Icon name={MODE_LABELS[candidateMode].icon} size={15} />
              <span>{MODE_LABELS[candidateMode].th}</span>
            </button>
          ))}
        </div>

        <div className="lab-map-search-wrap">
          <label htmlFor={`lab-map-search-${map.stationCode}`}>ค้นหา</label>
          <div className="lab-map-search-field">
            <Icon name="search" size={16} />
            <input
              ref={searchRef}
              id={`lab-map-search-${map.stationCode}`}
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

      {mode === 'safety' && stationPickerItems.length > 1 ? (
        <div className="lab-map-station-picker">
          <FilterChips
            label="เลือกจุดที่คุณอยู่"
            items={stationPickerItems}
            value={safetyStationCode}
            onChange={setSafetyStationCode}
            compact
          />
        </div>
      ) : null}

      {activeVisitorRoute ? (
        <ol className="lab-map-route-steps" aria-label="ขั้นตอนการเดินไปยังจุดสแกนนิ้วมือ">
          {activeVisitorRoute.directionsTh.map((step, index) => (
            <li key={`${index}-${step}`}><b>{index + 1}</b><span>{step}</span></li>
          ))}
        </ol>
      ) : null}

      <div className="lab-map-workspace">
        <LabMapCanvas
          map={map}
          mode={mode}
          selectedCode={selectedCode}
          activeRouteCodes={activeRouteCodes}
          destinationPointCode={mode === 'safety' ? null : destinationPointCode}
          activeStationCode={mode === 'safety' ? safetyStationCode : map.stationCode}
          highlightedSpaceCodes={highlightedSpaceCodes}
          onSelect={selectMapItem}
        />

        <aside
          className="lab-map-detail-panel"
          data-open={(mode === 'safety' || selectedCode !== null) || undefined}
          aria-label="รายละเอียดพื้นที่และเส้นทาง"
        >
          {mode !== 'safety' && selectedCode ? (
            <button className="lab-map-detail-close" type="button" onClick={closeDetail} aria-label="ปิดรายละเอียด">×</button>
          ) : null}
          {mode === 'safety'
            ? safetyDetail
            : renderDetail
              ? renderDetail(selectedCode, map)
              : defaultDetail}
        </aside>
      </div>

      {mode === 'infection' ? (
        <div className="lab-map-legend" aria-label="คำอธิบายเขตควบคุมการติดเชื้อ">
          <span><i data-class="infectious" />พื้นที่ติดเชื้อ</span>
          <span><i data-class="clean" />พื้นที่สะอาด</span>
          <span><i data-class="risk" />พื้นที่เสี่ยง</span>
        </div>
      ) : null}

      {mode === 'safety' ? (
        <div className="lab-map-legend" aria-label="คำอธิบายสัญลักษณ์ความปลอดภัย">
          <span><i data-class="route-primary" />เส้นทางหลัก</span>
          <span><i data-class="route-alternate" />เส้นทางสำรอง</span>
          <span><i data-class="exit" />ทางออกหนีไฟ</span>
          <span><i data-class="locked" />ประตูล็อคถาวร</span>
          <span><i data-class="station" />คุณอยู่ที่นี่</span>
          <span><i data-class="lift-restricted" />ห้ามใช้ลิฟต์ขณะเกิดเหตุ</span>
          <span><i data-class="fire-extinguisher" />ถังดับเพลิง</span>
        </div>
      ) : null}

      {mode === 'safety-assets' ? (
        <div className="lab-map-legend" aria-label="คำอธิบายสัญลักษณ์อุปกรณ์ความปลอดภัย">
          <span><i data-class="fire-hose" />สายฉีดน้ำดับเพลิง</span>
          <span><i data-class="manual-call-point" />จุดกดแจ้งเหตุ</span>
          <span><i data-class="aed" />เครื่อง AED</span>
          <span><i data-class="first-aid-kit" />ชุดปฐมพยาบาล</span>
          <span><i data-class="eyewash" />ที่ล้างตา</span>
          <span><i data-class="emergency-shower" />ฝักบัวฉุกเฉิน</span>
          <span><i data-class="spill-kit" />ชุดจัดการสารหกรั่วไหล</span>
          <span><i data-class="emergency-shutoff" />จุดตัดระบบฉุกเฉิน</span>
        </div>
      ) : null}

      {mode === 'overview' ? (
        <div className="lab-map-legend" aria-label="คำอธิบายสัญลักษณ์แผนที่">
          <span><i data-class="fingerprint" />จุดสแกนนิ้วมือ</span>
          <span><i data-class="door" />ประตูทั่วไป (ไม่มีจุดสแกน)</span>
          <span><i data-class="locked" />ประตูล็อคถาวร</span>
          <span><i data-class="controlled" />พื้นที่ควบคุมการเข้าออก</span>
        </div>
      ) : null}
      <SafetyEquipmentDetailDialog
        equipment={selectedExtinguisher}
        asset={inspectionAsset}
        loading={inspectionLoading}
        error={inspectionError}
        onClose={closeDetail}
      />
    </div>
  )
}
