'use client'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type {
  ChemicalProductDTO,
  ChemicalRegistryRow,
  ChemicalSdsDTO,
  ChemicalStorageLocationDTO,
  ChemicalUnitDTO,
} from '@/lib/chemical-safety/types'
import { RegistryChangeModal } from './RegistryChangeModal'
import { SdsEditorModal } from './SdsEditorModal'
import { FONT, SPACE } from './shared/tokens'

export type ChemicalDetailsTab = 'registry' | 'sds'

interface Props {
  activeTab: ChemicalDetailsTab
  row: ChemicalRegistryRow
  product?: ChemicalProductDTO
  locations: ChemicalStorageLocationDTO[]
  units: ChemicalUnitDTO[]
  products: ChemicalProductDTO[]
  sds: ChemicalSdsDTO | null
  sdsLoading: boolean
  onTabChange: (tab: ChemicalDetailsTab) => void
  onClose: () => void
  onSaved: (message: string, ok?: boolean) => void
}

export function ChemicalDetailsModal({
  activeTab, row, product, locations, units, products, sds, sdsLoading,
  onTabChange, onClose, onSaved,
}: Props) {
  const hasFile = Boolean(sds?.fileId)
  const sdsLabel = sdsLoading
    ? 'กำลังเตรียม SDS…'
    : hasFile
      ? 'มี SDS แล้ว'
      : sds
        ? 'รอแนบไฟล์ PDF'
        : 'ยังไม่มี SDS'
  const sdsColor = sdsLoading ? 'blue' : hasFile ? 'green' : 'amber'

  return (
    <div
      className="chemical-details-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`รายละเอียดสาร ${row.canonicalName}`}
    >
      <style>{`
        .chemical-details-overlay{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:clamp(8px,3vw,20px);background:rgba(0,0,0,.5)}
        .chemical-details-dialog{display:flex;flex-direction:column;width:100%;max-width:920px;max-height:92vh;overflow:hidden;border-radius:16px;background:var(--card);box-shadow:0 20px 60px rgba(0,0,0,.25)}
        .chemical-details-header{display:flex;align-items:flex-start;justify-content:space-between;gap:${SPACE.sm}px;padding:${SPACE.md}px;border-bottom:1px solid var(--border)}
        .chemical-details-heading{min-width:0}
        .chemical-details-heading h2{margin:0;color:var(--ink);font-size:${FONT.xl}px;letter-spacing:-.02em}
        .chemical-details-heading p{margin:5px 0 0;overflow:hidden;color:var(--muted);font-size:${FONT.sm}px;text-overflow:ellipsis;white-space:nowrap}
        .chemical-details-header-actions{display:flex;align-items:center;gap:${SPACE.xs}px;flex:0 0 auto}
        .chemical-details-tablist{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px;padding:6px;border-bottom:1px solid var(--border);background:var(--surface-2)}
        .chemical-details-tab{min-height:44px;padding:8px 12px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--muted);font:inherit;font-size:${FONT.md}px;font-weight:700;cursor:pointer;transition:background .15s ease,color .15s ease,border-color .15s ease}
        .chemical-details-tab:hover{background:var(--card);color:var(--ink)}
        .chemical-details-tab[aria-selected="true"]{border-color:color-mix(in srgb,var(--primary) 22%,var(--border));background:var(--card);color:var(--primary);box-shadow:0 2px 6px rgba(15,23,42,.06)}
        .chemical-details-tab:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:1px}
        .chemical-details-panel{min-height:0;overflow:auto}
        .chemical-details-empty{display:grid;justify-items:center;gap:${SPACE.xs}px;padding:${SPACE.xl}px ${SPACE.md}px;text-align:center;color:var(--muted)}
        .chemical-details-empty h3{margin:0;color:var(--ink);font-size:${FONT.lg}px}
        .chemical-details-empty p{max-width:52ch;margin:0;font-size:${FONT.sm}px;line-height:1.55}
        @media(max-width:560px){.chemical-details-header{padding:${SPACE.sm}px ${SPACE.md}px}.chemical-details-header-actions{align-items:flex-start;flex-direction:column-reverse}.chemical-details-heading h2{font-size:${FONT.lg}px}.chemical-details-heading p{max-width:45vw;white-space:normal}.chemical-details-tab{font-size:${FONT.sm}px}}
        @media(prefers-reduced-motion:reduce){.chemical-details-tab{transition:none}}
      `}</style>

      <div className="chemical-details-dialog">
        <header className="chemical-details-header">
          <div className="chemical-details-heading">
            <h2>รายละเอียดสาร</h2>
            <p>
              <strong style={{ color: 'var(--ink)' }}>ข้อมูลสารเคมีหลัก: {product?.canonicalName ?? row.canonicalName}</strong>
              {row.casNumber ? ` · CAS ${row.casNumber}` : ''}
            </p>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: FONT.xs }}>
              รายการคลังของงาน/ห้องนี้: {row.storageScope === 'room' ? 'ห้องเก็บสารเคมี' : row.unitName}
            </p>
          </div>
          <div className="chemical-details-header-actions">
            <Badge color={sdsColor}>{sdsLabel}</Badge>
            <Button variant="ghost" icon="x" title="ปิดรายละเอียดสาร" onClick={onClose} />
          </div>
        </header>

        <div className="chemical-details-tablist" role="tablist" aria-label="ส่วนรายละเอียดสาร">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'registry'}
            aria-controls="chemical-details-registry-panel"
            className="chemical-details-tab"
            onClick={() => onTabChange('registry')}
          >
            ข้อมูลทะเบียน
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'sds'}
            aria-controls="chemical-details-sds-panel"
            className="chemical-details-tab"
            onClick={() => onTabChange('sds')}
          >
            เอกสาร SDS
          </button>
        </div>

        <div
          id={activeTab === 'registry' ? 'chemical-details-registry-panel' : 'chemical-details-sds-panel'}
          className="chemical-details-panel"
          role="tabpanel"
          aria-label={activeTab === 'registry' ? 'ข้อมูลทะเบียน' : 'เอกสาร SDS'}
        >
          {activeTab === 'registry' ? (
            product ? (
              <RegistryChangeModal
                embedded
                mode="edit-product"
                locations={locations}
                units={units}
                products={products}
                product={product}
                registryRow={row}
                onClose={onClose}
                onSaved={onSaved}
              />
            ) : (
              <div className="chemical-details-empty" role="alert">
                <Icon name="alert" size={24} />
                <h3>ไม่พบข้อมูลสารในทะเบียน</h3>
                <p>กรุณารีเฟรชหน้า แล้วลองเปิดรายละเอียดสารอีกครั้ง</p>
              </div>
            )
          ) : sds ? (
            <SdsEditorModal
              embedded
              sds={sds}
              productName={row.canonicalName}
              seed={{
                pictogramCodes: row.pictogramCodes,
                hazardClassesTh: row.hazards.map(hazard => hazard.className),
              }}
              onClose={onClose}
              onSaved={onSaved}
            />
          ) : (
            <div className="chemical-details-empty" aria-live="polite">
              <Icon name={sdsLoading ? 'clock' : 'upload'} size={28} />
              <h3>{sdsLoading ? 'กำลังเตรียมเอกสาร SDS…' : 'ยังไม่มีข้อมูล SDS'}</h3>
              <p>
                {sdsLoading
                  ? 'กำลังสร้างพื้นที่สำหรับแนบ PDF ให้รายการนี้'
                  : 'เลือกลองอีกครั้งเพื่อเตรียมเอกสาร SDS สำหรับสารนี้'}
              </p>
              {!sdsLoading && <Button icon="upload" onClick={() => onTabChange('sds')}>เตรียมเอกสาร SDS</Button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
