'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type { DepartmentSdsGroupDTO } from '@/lib/chemical-safety/department-repository'
import { calculateHoldingTotalFromFields, isMeasuredUnit } from '@/lib/chemical-safety/domain'
import type {
  ChemicalProductDTO,
  ChemicalUnitDTO,
  GhsPictogramCode,
} from '@/lib/chemical-safety/types'
import { GhsPictogram } from './GhsPictogram'
import { FONT, SPACE } from './shared/tokens'

const ALL_PICTOGRAMS: GhsPictogramCode[] = [
  'GHS01', 'GHS02', 'GHS03', 'GHS04', 'GHS05', 'GHS06', 'GHS07', 'GHS08', 'GHS09',
]
const PHYSICAL_STATES = ['', 'solid', 'liquid', 'gas', 'mixture', 'unknown'] as const
// รายการแนะนำในช่องหน่วย — พิมพ์หน่วยอื่นได้อิสระ (เช่น 'test' สำหรับ test kit ที่นับเป็นจำนวนครั้งตรวจ ไม่ใช่ปริมาตร/น้ำหนัก)
const PACKAGE_UNIT_SUGGESTIONS = ['mL', 'L', 'g', 'kg', 'test', 'kit', 'ชิ้น', 'ea'] as const
const CUSTOM_UNIT_VALUE = '__custom__'

const inputStyle: CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)',
  outline: 'none', boxSizing: 'border-box', minHeight: 44,
}
const labelStyle: CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}
const gridStyle: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: SPACE.sm,
}
const sectionStyle: CSSProperties = { margin: `0 0 ${SPACE.xs}px`, fontSize: FONT.lg, fontWeight: 800, color: 'var(--ink)' }

interface HazardDraft { classTh: string; classEn: string }

export function DepartmentChemicalModal({
  group, initialFileId, products, units, onClose, onSaved,
}: {
  group: DepartmentSdsGroupDTO
  initialFileId?: string
  products: ChemicalProductDTO[]
  units: ChemicalUnitDTO[]
  onClose: () => void
  onSaved: (message: string, ok?: boolean) => void
}) {
  const activeProducts = useMemo(() => products.filter(product => product.lifecycleStatus === 'active'), [products])
  const unlinkedFiles = useMemo(
    () => group.files.filter(file => file.registryLink.status === 'unlinked'),
    [group.files],
  )
  const [sourceFileId, setSourceFileId] = useState(
    initialFileId && unlinkedFiles.some(file => file.id === initialFileId) ? initialFileId : unlinkedFiles[0]?.id ?? '',
  )
  const [productMode, setProductMode] = useState<'new' | 'existing'>('new')
  const [productSearch, setProductSearch] = useState('')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const selectedProduct = activeProducts.find(product => product.id === selectedProductId) ?? null

  const [canonicalName, setCanonicalName] = useState('')
  const [aliasesText, setAliasesText] = useState('')
  const [casNumber, setCasNumber] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [supplier, setSupplier] = useState('')
  const [productCode, setProductCode] = useState('')
  const [concentration, setConcentration] = useState('')
  const [physicalState, setPhysicalState] = useState('')
  const [ghsSourceText, setGhsSourceText] = useState('')
  const [pictograms, setPictograms] = useState<GhsPictogramCode[]>([])
  const [hazards, setHazards] = useState<HazardDraft[]>([])

  const [lotNumber, setLotNumber] = useState('')
  const [packageValue, setPackageValue] = useState('')
  const [packageUnit, setPackageUnit] = useState<string>('mL')
  const [unitMode, setUnitMode] = useState<'preset' | 'custom'>('preset')
  const [currentContainerCount, setCurrentContainerCount] = useState('')
  const [minimumStock, setMinimumStock] = useState('')
  const [receivedOn, setReceivedOn] = useState('')
  const [openedOn, setOpenedOn] = useState('')
  const [expiresOn, setExpiresOn] = useState('')
  const [effectiveOn, setEffectiveOn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const unit = units.find(item => item.id === group.chemicalUnitId) ?? null
  const sourceFile = unlinkedFiles.find(file => file.id === sourceFileId) ?? null
  const normalizedSearch = productSearch.trim().toLocaleLowerCase('th')
  const productOptions = useMemo(() => activeProducts.filter(product => {
    if (!normalizedSearch) return true
    return [product.canonicalName, product.casNumber, product.manufacturer, product.supplier]
      .filter(Boolean).join(' ').toLocaleLowerCase('th').includes(normalizedSearch)
  }).slice(0, 12), [activeProducts, normalizedSearch])
  // หน่วยนับจำนวน (เช่น 'test', 'kit') ไม่มีแนวคิด "ภาชนะ" ให้คูณ — กรอกปริมาณคงเหลือตรงๆ ไม่คำนวณ
  const isMeasured = isMeasuredUnit(packageUnit)
  const effectiveContainerCount = isMeasured ? Number(currentContainerCount) : 1

  const calculatedTotal = useMemo(() => {
    if (!isMeasured) return null
    if (!packageValue.trim() || !currentContainerCount.trim()) return null
    return calculateHoldingTotalFromFields({
      packageValue: Number(packageValue),
      packageUnit,
      currentContainerCount: effectiveContainerCount,
    })
  }, [isMeasured, packageValue, packageUnit, currentContainerCount, effectiveContainerCount])

  function selectProduct(product: ChemicalProductDTO) {
    setSelectedProductId(product.id)
    setCanonicalName(product.canonicalName)
    setCasNumber(product.casNumber ?? '')
    setManufacturer(product.manufacturer ?? '')
    setSupplier(product.supplier ?? '')
    setProductCode(product.productCode ?? '')
    setConcentration(product.concentration ?? '')
    setPhysicalState(product.physicalState ?? '')
    setGhsSourceText(product.ghsSourceText ?? '')
    setPictograms(product.ghsPictogramCodes)
    setHazards(product.ghsHazardClasses)
    setProductSearch('')
    setError(null)
  }

  function clearSelectedProduct() {
    setSelectedProductId(null)
    setCanonicalName('')
    setCasNumber('')
    setManufacturer('')
    setSupplier('')
    setProductCode('')
    setConcentration('')
    setPhysicalState('')
    setGhsSourceText('')
    setPictograms([])
    setHazards([])
  }

  function togglePictogram(code: GhsPictogramCode) {
    setPictograms(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code].sort())
  }

  async function submit() {
    if (!unit) { setError('ยังไม่มีหน่วยงานเคมีที่ตรงกับงานนี้ กรุณาตรวจสอบการตั้งค่า chemical_units'); return }
    if (!sourceFile) { setError('กรุณาเลือกไฟล์ SDS เป็นแหล่งอ้างอิง'); return }
    if (productMode === 'existing' && !selectedProduct) { setError('กรุณาเลือกสารเดิมจากรายการ หรือเลือกสร้างสารใหม่'); return }
    if (!canonicalName.trim()) { setError('กรุณาระบุชื่อสาร'); return }
    if (!packageValue.trim() || !Number.isFinite(Number(packageValue)) || Number(packageValue) < 0) {
      setError(isMeasured ? 'กรุณาระบุปริมาตร/น้ำหนักต่อภาชนะให้ถูกต้อง' : 'กรุณาระบุปริมาณคงเหลือให้ถูกต้อง'); return
    }
    if (isMeasured && (!currentContainerCount.trim() || !Number.isInteger(Number(currentContainerCount)) || Number(currentContainerCount) < 0)) {
      setError('กรุณาระบุจำนวนภาชนะเป็นจำนวนเต็ม'); return
    }
    if (!minimumStock.trim() || !Number.isInteger(Number(minimumStock)) || Number(minimumStock) < 0) {
      setError('กรุณาระบุจำนวนสต๊อกขั้นต่ำเป็นจำนวนเต็ม'); return
    }

    setBusy(true)
    setError(null)
    try {
      const body = {
        productId: productMode === 'existing' ? selectedProductId : null,
        canonicalName: canonicalName.trim(),
        aliases: productMode === 'new' ? aliasesText.split(',').map(item => item.trim()).filter(Boolean) : [],
        casNumber: casNumber.trim() || null,
        manufacturer: manufacturer.trim() || null,
        supplier: supplier.trim() || null,
        productCode: productCode.trim() || null,
        concentration: concentration.trim() || null,
        physicalState: physicalState || null,
        storageScope: 'department' as const,
        locationId: null,
        lotNumber: lotNumber.trim() || null,
        packageValue: Number(packageValue),
        packageUnit,
        currentContainerCount: effectiveContainerCount,
        minimumStock: Number(minimumStock),
        reportedTotalRaw: null,
        calculatedTotalValue: calculatedTotal?.value ?? null,
        calculatedTotalUnit: calculatedTotal?.unit ?? null,
        receivedOn: receivedOn || null,
        openedOn: openedOn || null,
        expiresOn: expiresOn || null,
        effectiveOn: effectiveOn || null,
        ghsSourceText: ghsSourceText.trim() || null,
        ghsPictogramCodes: pictograms,
        ghsHazardClasses: hazards.filter(item => item.classTh.trim() && item.classEn.trim()),
      }
      const created = await fetch(`/api/admin/chemical-safety/department-sds/${sourceFile.id}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const createdPayload = await created.json().catch(() => ({}))
      if (!created.ok) throw new Error(createdPayload.error || 'สร้างคำขอเข้าสู่ทะเบียนไม่สำเร็จ')

      const requestId = createdPayload.data?.id
      if (typeof requestId !== 'string') throw new Error('ระบบไม่คืนเลขคำขอเข้าสู่ทะเบียน')
      const submitted = await fetch(`/api/admin/chemical-safety/change-requests/${requestId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const submittedPayload = await submitted.json().catch(() => ({}))
      if (!submitted.ok) throw new Error(submittedPayload.error || 'บันทึกการนำเข้าทะเบียนไม่สำเร็จ')

      onSaved('เพิ่มสารจาก SDS งานเข้าทะเบียนแล้ว')
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const fieldsLocked = productMode === 'existing' && selectedProduct !== null
  const title = `นำเข้าสารเคมีจาก SDS · ${group.department}`

  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 820, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
        <header style={{ padding: SPACE.md, borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>ทะเบียนสารเคมี · ตามหน่วยงาน</div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>{title}</h2>
            <p style={{ margin: '4px 0 0', fontSize: FONT.sm, color: 'var(--muted)' }}>รายการนี้จะแสดงในทะเบียน แต่ไม่มีตำแหน่งในผังจัดเก็บ</p>
          </div>
          <Button variant="ghost" icon="x" title="ปิด" onClick={onClose} disabled={busy} />
        </header>

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.md }}>
          <section>
            <h3 style={sectionStyle}>ไฟล์ SDS แหล่งอ้างอิง *</h3>
            <label>
              <span style={labelStyle}>เลือกไฟล์ในงาน {group.department}</span>
              <select value={sourceFileId} onChange={event => setSourceFileId(event.target.value)} style={inputStyle} disabled={busy}>
                <option value="">เลือกไฟล์ SDS</option>
                {unlinkedFiles.map(file => <option key={file.id} value={file.id}>{file.displayName}</option>)}
              </select>
            </label>
            {!sourceFile && <p style={{ margin: `${SPACE.xs}px 0 0`, fontSize: FONT.sm, color: 'var(--warning)' }}><Icon name="alert" size={13} /> ต้องเลือกไฟล์ SDS ก่อนนำเข้า</p>}
          </section>

          <section>
            <h3 style={sectionStyle}>สารเคมีในทะเบียน</h3>
            <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap', marginBottom: SPACE.sm }}>
              <Button variant={productMode === 'existing' ? 'primary' : 'secondary'} size="sm" icon="search" onClick={() => setProductMode('existing')} disabled={busy}>เลือกสารเดิม</Button>
              <Button variant={productMode === 'new' ? 'primary' : 'secondary'} size="sm" icon="plus" onClick={() => { setProductMode('new'); clearSelectedProduct() }} disabled={busy}>สร้างสารใหม่</Button>
              {selectedProduct && <Badge color="green"><Icon name="check" size={12} /> ใช้ product เดิม</Badge>}
            </div>
            {productMode === 'existing' && (
              <div style={{ display: 'grid', gap: SPACE.xs }}>
                <input
                  value={productSearch}
                  onChange={event => setProductSearch(event.target.value)}
                  placeholder="ค้นหาชื่อสาร เลข CAS ผู้ผลิต หรือผู้จำหน่าย"
                  style={inputStyle}
                  disabled={busy || fieldsLocked}
                />
                {selectedProduct ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: SPACE.sm, padding: SPACE.sm, borderRadius: 10, background: 'var(--primary-soft)' }}>
                    <span><strong>{selectedProduct.canonicalName}</strong>{selectedProduct.casNumber ? ` · CAS ${selectedProduct.casNumber}` : ''}</span>
                    <Button variant="ghost" size="sm" icon="x" onClick={clearSelectedProduct} disabled={busy}>เปลี่ยนสาร</Button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 4, maxHeight: 190, overflowY: 'auto' }}>
                    {productOptions.map(product => (
                      <button key={product.id} type="button" onClick={() => selectProduct(product)} style={{ display: 'flex', justifyContent: 'space-between', gap: SPACE.sm, textAlign: 'left', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--card)', color: 'var(--ink)', font: 'inherit', cursor: 'pointer' }}>
                        <span><strong>{product.canonicalName}</strong><br /><small style={{ color: 'var(--muted)' }}>{product.casNumber ? `CAS ${product.casNumber}` : 'ไม่ระบุ CAS'}{product.manufacturer ? ` · ${product.manufacturer}` : ''}</small></span>
                        <Icon name="arrowRight" size={14} />
                      </button>
                    ))}
                    {productOptions.length === 0 && <span style={{ padding: SPACE.sm, color: 'var(--muted)', fontSize: FONT.sm }}>ไม่พบสารที่ค้นหา — เลือก “สร้างสารใหม่” หากตรวจแล้วว่าไม่ซ้ำ</span>}
                  </div>
                )}
              </div>
            )}
            <div style={{ ...gridStyle, marginTop: SPACE.sm }}>
              <Field label="ชื่อสาร *" value={canonicalName} onChange={setCanonicalName} disabled={busy || fieldsLocked} />
              {productMode === 'new' && <Field label="ชื่อพ้อง (คั่นด้วยจุลภาค)" value={aliasesText} onChange={setAliasesText} disabled={busy} />}
              <Field label="เลขทะเบียน CAS" value={casNumber} onChange={setCasNumber} placeholder="64-19-7" disabled={busy || fieldsLocked} />
              <Field label="ผู้ผลิต" value={manufacturer} onChange={setManufacturer} disabled={busy || fieldsLocked} />
              <Field label="ผู้จำหน่าย" value={supplier} onChange={setSupplier} disabled={busy || fieldsLocked} />
              <Field label="รหัสผลิตภัณฑ์" value={productCode} onChange={setProductCode} disabled={busy || fieldsLocked} />
              <Field label="ความเข้มข้น" value={concentration} onChange={setConcentration} disabled={busy || fieldsLocked} />
              <label>
                <span style={labelStyle}>สถานะทางกายภาพ</span>
                <select value={physicalState} onChange={event => setPhysicalState(event.target.value)} style={inputStyle} disabled={busy || fieldsLocked}>
                  {PHYSICAL_STATES.map(state => <option key={state || 'none'} value={state}>{state || 'ไม่ระบุ'}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section>
            <h3 style={sectionStyle}>หน่วยงานและคลัง (ไม่มีตำแหน่งจัดเก็บ)</h3>
            <div style={{ ...gridStyle, marginBottom: SPACE.sm }}>
              <label>
                <span style={labelStyle}>หน่วยงานที่รับผิดชอบ *</span>
                <input value={unit?.nameTh ?? 'ไม่พบหน่วยงาน'} style={inputStyle} disabled readOnly />
              </label>
              <label>
                <span style={labelStyle}>ขอบเขตการจัดเก็บ</span>
                <input value="ตามหน่วยงาน · ไม่จัดผัง" style={inputStyle} disabled readOnly />
              </label>
            </div>
            <div style={gridStyle}>
              <Field label="เลขล็อต" value={lotNumber} onChange={setLotNumber} disabled={busy} />
              <Field label={isMeasured ? 'ปริมาณต่อภาชนะ *' : 'ปริมาณคงเหลือ *'} value={packageValue} onChange={setPackageValue} type="number" disabled={busy} />
              <label>
                <span style={labelStyle}>หน่วย *</span>
                <select
                  value={unitMode === 'custom' ? CUSTOM_UNIT_VALUE : packageUnit}
                  onChange={event => {
                    const next = event.target.value
                    if (next === CUSTOM_UNIT_VALUE) { setUnitMode('custom') }
                    else { setUnitMode('preset'); setPackageUnit(next) }
                  }}
                  style={inputStyle}
                  disabled={busy}
                >
                  {PACKAGE_UNIT_SUGGESTIONS.map(item => <option key={item} value={item}>{item}</option>)}
                  <option value={CUSTOM_UNIT_VALUE}>อื่นๆ (ระบุเอง)</option>
                </select>
                {unitMode === 'custom' && (
                  <input
                    value={packageUnit}
                    onChange={event => setPackageUnit(event.target.value)}
                    style={{ ...inputStyle, marginTop: 6 }}
                    disabled={busy}
                    placeholder="พิมพ์หน่วย เช่น test, kit"
                  />
                )}
              </label>
              {isMeasured && (
                <Field label="จำนวนภาชนะปัจจุบัน *" value={currentContainerCount} onChange={setCurrentContainerCount} type="number" disabled={busy} />
              )}
              <Field label="จำนวนสต๊อกขั้นต่ำ *" value={minimumStock} onChange={setMinimumStock} type="number" disabled={busy} />
              {calculatedTotal && <div style={{ gridColumn: '1 / -1', padding: `${SPACE.xs}px ${SPACE.sm}px`, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: FONT.sm }}>ปริมาณรวมที่คำนวณอัตโนมัติ: <strong>{calculatedTotal.value.toLocaleString('th-TH', { maximumFractionDigits: 6 })} {calculatedTotal.unit}</strong></div>}
              <Field label="วันที่รับเข้า" value={receivedOn} onChange={setReceivedOn} type="date" disabled={busy} />
              <Field label="วันที่เปิดใช้" value={openedOn} onChange={setOpenedOn} type="date" disabled={busy} />
              <Field label="วันหมดอายุ" value={expiresOn} onChange={setExpiresOn} type="date" disabled={busy} />
              <Field label="วันที่มีผล" value={effectiveOn} onChange={setEffectiveOn} type="date" disabled={busy} />
            </div>
          </section>

          <section>
            <h3 style={sectionStyle}>GHS สำหรับทะเบียน</h3>
            <label style={{ display: 'block', marginBottom: SPACE.sm }}>
              <span style={labelStyle}>แหล่งข้อมูลเบื้องต้น</span>
              <textarea value={ghsSourceText} onChange={event => setGhsSourceText(event.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} disabled={busy || fieldsLocked} placeholder="เช่น ข้อมูลจาก SDS หมวด 2" />
            </label>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend style={labelStyle}>สัญลักษณ์</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: SPACE.xs }}>
                {ALL_PICTOGRAMS.map(code => {
                  const checked = pictograms.includes(code)
                  return (
                    <label key={code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minHeight: 44, padding: SPACE.xs, borderRadius: 10, cursor: fieldsLocked ? 'default' : 'pointer', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, background: checked ? 'var(--primary-soft)' : 'var(--card)' }}>
                      <input type="checkbox" checked={checked} onChange={() => togglePictogram(code)} disabled={busy || fieldsLocked} style={{ width: 18, height: 18 }} />
                      <GhsPictogram code={code} size={32} />
                    </label>
                  )
                })}
              </div>
            </fieldset>
            <fieldset style={{ border: '1px solid var(--border)', borderRadius: 10, padding: SPACE.sm, margin: `${SPACE.sm}px 0 0` }}>
              <legend style={{ ...labelStyle, marginBottom: 0, padding: '0 6px' }}>ประเภทและหมวดความเป็นอันตราย</legend>
              <div style={{ display: 'grid', gap: SPACE.xs }}>
                {hazards.map((row, index) => (
                  <div key={index} style={{ display: 'flex', gap: SPACE.xs, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <label style={{ flex: '1 1 200px' }}><span style={labelStyle}>ประเภท (ไทย)</span><input value={row.classTh} onChange={event => { const next = [...hazards]; next[index] = { ...row, classTh: event.target.value }; setHazards(next) }} style={inputStyle} disabled={busy || fieldsLocked} /></label>
                    <label style={{ flex: '1 1 200px' }}><span style={labelStyle}>Class (English)</span><input value={row.classEn} onChange={event => { const next = [...hazards]; next[index] = { ...row, classEn: event.target.value }; setHazards(next) }} style={inputStyle} disabled={busy || fieldsLocked} /></label>
                    <Button variant="ghost" icon="trash" size="lg" title="ลบรายการนี้" onClick={() => setHazards(hazards.filter((_, itemIndex) => itemIndex !== index))} disabled={busy || fieldsLocked} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: SPACE.xs }}><Button variant="soft" icon="plus" onClick={() => setHazards([...hazards, { classTh: '', classEn: '' }])} disabled={busy || fieldsLocked}>เพิ่มรายการ</Button></div>
            </fieldset>
          </section>

          {error && <p role="alert" style={{ margin: 0, padding: SPACE.xs, borderRadius: 8, fontSize: FONT.base, background: 'rgba(220,38,38,.10)', color: 'var(--danger)', fontWeight: 600 }}><Icon name="alert" size={13} /> {error}</p>}
        </div>

        <footer style={{ padding: SPACE.md, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs }}>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button icon="arrowRight" size="lg" onClick={() => void submit()} disabled={busy || unlinkedFiles.length === 0}>{busy ? 'กำลังบันทึก…' : 'บันทึก'}</Button>
        </footer>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder, disabled }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} style={inputStyle} disabled={disabled} />
    </label>
  )
}
