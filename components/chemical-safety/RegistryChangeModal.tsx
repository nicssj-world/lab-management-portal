'use client'

import { useMemo, useState, type CSSProperties } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import type {
  ChemicalProductDTO,
  ChemicalRegistryRow,
  ChemicalStorageLocationDTO,
  ChemicalUnitDTO,
  GhsPictogramCode,
} from '@/lib/chemical-safety/types'
import { calculateHoldingTotalFromFields, isMeasuredUnit } from '@/lib/chemical-safety/domain'
import { CHEMICAL_SDS_DEPARTMENTS } from '@/lib/chemical-safety/departments'
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

export type RegistryChangeMode = 'create' | 'edit-product' | 'edit-holding'

export function RegistryChangeModal({
  mode, locations, units, products, product, registryRow, onClose, onSaved,
}: {
  mode: RegistryChangeMode
  locations: ChemicalStorageLocationDTO[]
  units: ChemicalUnitDTO[]
  products: ChemicalProductDTO[]
  /** จำเป็นเมื่อ mode = 'edit-product' */
  product?: ChemicalProductDTO
  /** จำเป็นเมื่อ mode = 'edit-holding' หรือใช้เติมหน่วยงานเริ่มต้นตอน 'create' */
  registryRow?: ChemicalRegistryRow
  onClose: () => void
  onSaved: (message: string, ok?: boolean) => void
}) {
  const isCreate = mode === 'create'
  const isProduct = mode === 'edit-product'
  const isHolding = mode === 'edit-holding'
  const [productMode, setProductMode] = useState<'new' | 'existing'>('new')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [storageScope, setStorageScope] = useState<'room' | 'department'>(registryRow?.storageScope ?? 'room')
  const isDepartment = isHolding
    ? registryRow?.storageScope === 'department'
    : isCreate && storageScope === 'department'
  const departmentNames = useMemo(
    () => new Set<string>(CHEMICAL_SDS_DEPARTMENTS.map(department => department.department)),
    [],
  )
  const selectableUnits = isDepartment
    ? units.filter(unit => departmentNames.has(unit.nameTh))
    : units

  const [canonicalName, setCanonicalName] = useState(product?.canonicalName ?? registryRow?.canonicalName ?? '')
  const [aliasesText, setAliasesText] = useState(registryRow?.aliases.join(', ') ?? '')
  const [casNumber, setCasNumber] = useState(product?.casNumber ?? registryRow?.casNumber ?? '')
  const [manufacturer, setManufacturer] = useState(product?.manufacturer ?? '')
  const [supplier, setSupplier] = useState(product?.supplier ?? '')
  const [productCode, setProductCode] = useState(product?.productCode ?? '')
  const [concentration, setConcentration] = useState(product?.concentration ?? registryRow?.concentration ?? '')
  const [physicalState, setPhysicalState] = useState(product?.physicalState ?? '')
  const [lifecycleStatus, setLifecycleStatus] = useState(product?.lifecycleStatus ?? 'active')
  const [ghsSourceText, setGhsSourceText] = useState(product?.ghsSourceText ?? '')

  const [unitId, setUnitId] = useState(registryRow?.unitId ?? units[0]?.id ?? '')
  const [locationId, setLocationId] = useState(registryRow?.locationId ?? '')
  const [lotNumber, setLotNumber] = useState(registryRow?.lotNumber ?? '')
  const [packageValue, setPackageValue] = useState(String(registryRow?.packageValue ?? ''))
  const [packageUnit, setPackageUnit] = useState<string>(registryRow?.packageUnit ?? 'mL')
  const [unitMode, setUnitMode] = useState<'preset' | 'custom'>(() =>
    (PACKAGE_UNIT_SUGGESTIONS as readonly string[]).includes(registryRow?.packageUnit ?? 'mL') ? 'preset' : 'custom')
  const [currentContainerCount, setCurrentContainerCount] = useState(String(registryRow?.currentContainerCount ?? ''))
  const [minimumStock, setMinimumStock] = useState(String(registryRow?.minimumStock ?? ''))
  const [receivedOn, setReceivedOn] = useState(registryRow?.receivedOn ?? '')
  const [openedOn, setOpenedOn] = useState(registryRow?.openedOn ?? '')
  const [expiresOn, setExpiresOn] = useState(registryRow?.expiresOn ?? '')
  const [effectiveOn, setEffectiveOn] = useState(registryRow?.effectiveOn ?? '')

  // หน่วยนับจำนวน (เช่น 'test', 'kit') ไม่มีแนวคิด "ภาชนะ" ให้คูณ — กรอกปริมาณคงเหลือตรงๆ ไม่คำนวณ
  const isMeasured = isMeasuredUnit(packageUnit)
  const effectiveContainerCount = isMeasured ? Number(currentContainerCount) : 1

  const calculatedTotal = useMemo(() => {
    if (!isMeasured) return null
    if (!packageValue.trim() || !currentContainerCount.trim()) return null
    const derived = calculateHoldingTotalFromFields({
      packageValue: Number(packageValue),
      packageUnit,
      currentContainerCount: effectiveContainerCount,
    })
    const matchesExistingFields = registryRow
      && registryRow.packageValue === Number(packageValue)
      && registryRow.packageUnit === packageUnit
      && registryRow.currentContainerCount === Number(currentContainerCount)
    if (
      matchesExistingFields
      && registryRow.calculatedTotalValue != null
      && registryRow.calculatedTotalUnit
      && (!derived || derived.value !== registryRow.calculatedTotalValue || derived.unit !== registryRow.calculatedTotalUnit)
    ) {
      return { value: registryRow.calculatedTotalValue, unit: registryRow.calculatedTotalUnit }
    }
    return derived
  }, [isMeasured, packageValue, packageUnit, currentContainerCount, registryRow])

  const [pictograms, setPictograms] = useState<GhsPictogramCode[]>(product?.ghsPictogramCodes ?? [])
  const [hazards, setHazards] = useState<HazardDraft[]>(product?.ghsHazardClasses ?? [])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function togglePictogram(code: GhsPictogramCode) {
    setPictograms(current => current.includes(code) ? current.filter(item => item !== code) : [...current, code].sort())
  }

  function buildProductProposal() {
    return {
      canonicalName: canonicalName.trim(),
      casNumber: casNumber.trim() || null,
      manufacturer: manufacturer.trim() || null,
      supplier: supplier.trim() || null,
      productCode: productCode.trim() || null,
      concentration: concentration.trim() || null,
      physicalState: physicalState || null,
      lifecycleStatus,
      ghsSourceText: ghsSourceText.trim() || null,
      ghsPictogramCodes: pictograms,
      ghsHazardClasses: hazards.filter(item => item.classTh.trim() && item.classEn.trim()),
    }
  }

  function buildHoldingProposal() {
    return {
      productId: registryRow?.productId,
      storageScope: isDepartment ? 'department' as const : 'room' as const,
      locationId: isDepartment ? null : locationId,
      lotNumber: lotNumber.trim() || null,
      packageValue: Number(packageValue),
      packageUnit,
      currentContainerCount: effectiveContainerCount,
      minimumStock: Number(minimumStock),
      calculatedTotalValue: calculatedTotal?.value ?? null,
      calculatedTotalUnit: calculatedTotal?.unit ?? null,
      receivedOn: receivedOn || null,
      openedOn: openedOn || null,
      expiresOn: expiresOn || null,
      effectiveOn: effectiveOn || null,
    }
  }

  function buildNewChemicalProposal() {
    const productProposal = buildProductProposal()
    return {
      canonicalName: productProposal.canonicalName,
      aliases: aliasesText.split(',').map(item => item.trim()).filter(Boolean),
      casNumber: productProposal.casNumber,
      manufacturer: productProposal.manufacturer,
      supplier: productProposal.supplier,
      productCode: productProposal.productCode,
      concentration: productProposal.concentration,
      physicalState: productProposal.physicalState,
      storageScope,
      locationId: isDepartment ? null : locationId,
      lotNumber: lotNumber.trim() || null,
      packageValue: Number(packageValue),
      packageUnit,
      currentContainerCount: effectiveContainerCount,
      minimumStock: Number(minimumStock),
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
  }

  async function submit() {
    if ((!isCreate || productMode === 'new') && !canonicalName.trim()) { setError('กรุณาระบุชื่อสาร'); return }
    if (isCreate && productMode === 'existing' && !selectedProductId) { setError('กรุณาเลือกสารเคมีเดิม'); return }
    if ((isCreate || isHolding) && !isDepartment && !locationId) { setError('กรุณาเลือกตำแหน่งจัดเก็บ'); return }
    if (!unitId) { setError('กรุณาเลือกหน่วยงานที่รับผิดชอบ'); return }

    setBusy(true)
    setError(null)
    try {
      const body = isProduct
        ? { entityType: 'product', entityId: product!.id, unitId, proposedData: buildProductProposal() }
        : isHolding
          ? { entityType: 'holding', entityId: registryRow!.holdingId, unitId, proposedData: buildHoldingProposal() }
          : {
              entityType: 'registry_entry',
              unitId,
              proposedData: productMode === 'existing'
                ? {
                    productMode: 'existing',
                    productId: selectedProductId,
                    storageScope,
                    locationId: isDepartment ? null : locationId,
                    lotNumber: lotNumber.trim() || null,
                    packageValue: Number(packageValue),
                    packageUnit,
                    currentContainerCount: effectiveContainerCount,
                    minimumStock: Number(minimumStock),
                    calculatedTotalValue: calculatedTotal?.value ?? null,
                    calculatedTotalUnit: calculatedTotal?.unit ?? null,
                    receivedOn: receivedOn || null,
                    openedOn: openedOn || null,
                    expiresOn: expiresOn || null,
                    effectiveOn: effectiveOn || null,
                  }
                : { productMode: 'new', ...buildNewChemicalProposal() },
            }

      const created = await fetch('/api/admin/chemical-safety/change-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const createdPayload = await created.json().catch(() => ({}))
      if (!created.ok) throw new Error(createdPayload.error || 'สร้างคำขอไม่สำเร็จ')

      const submitted = await fetch(`/api/admin/chemical-safety/change-requests/${createdPayload.data.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const submittedPayload = await submitted.json().catch(() => ({}))
      if (!submitted.ok) throw new Error(submittedPayload.error || 'บันทึกไม่สำเร็จ')

      onSaved('บันทึกลงทะเบียนสารเคมีแล้ว')
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'ดำเนินการไม่สำเร็จ')
    } finally {
      setBusy(false)
    }
  }

  const title = isCreate ? 'เพิ่มสารเคมีใหม่' : isProduct ? 'แก้ไขข้อมูลสาร' : isDepartment ? 'แก้ไขคลัง (ปริมาณ/วันที่)' : 'แก้ไขคลัง (ตำแหน่ง/ปริมาณ)'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 720,
        maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
      }}>
        <header style={{
          padding: SPACE.md, borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: SPACE.sm,
        }}>
          <div>
            <div style={{ fontSize: FONT.xs, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--primary)' }}>
              คำขอจะเข้าสู่การทบทวนโดยผู้อื่นก่อนมีผลจริง
            </div>
            <h2 style={{ margin: '4px 0 0', fontSize: FONT.xl, color: 'var(--ink)' }}>{title}</h2>
          </div>
          <Button variant="ghost" icon="x" onClick={onClose} title="ปิด" />
        </header>

        <div style={{ padding: SPACE.md, display: 'grid', gap: SPACE.md }}>
          {isCreate && (
            <section>
              <h3 style={sectionStyle}>เลือกรายการสารเคมี</h3>
              <div style={gridStyle}>
                <label>
                  <span style={labelStyle}>วิธีเพิ่มรายการ *</span>
                  <select value={productMode} onChange={(event) => setProductMode(event.target.value as 'new' | 'existing')} style={inputStyle}>
                    <option value="new">สร้าง product ใหม่</option>
                    <option value="existing">ใช้ product ที่มีอยู่</option>
                  </select>
                </label>
                {productMode === 'existing' && (
                  <label>
                    <span style={labelStyle}>สารเคมีเดิม *</span>
                    <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} style={inputStyle}>
                      <option value="">เลือกสารเคมี</option>
                      {products.filter(item => item.lifecycleStatus === 'active').map(item => (
                        <option key={item.id} value={item.id}>
                          {item.canonicalName}{item.manufacturer ? ` · ${item.manufacturer}` : ''}{item.productCode ? ` · ${item.productCode}` : ''}{item.concentration ? ` · ${item.concentration}` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {productMode === 'existing' && (
                <p style={{ margin: `${SPACE.xs}px 0 0`, color: 'var(--muted)', fontSize: FONT.xs }}>
                  ใช้ซ้ำเฉพาะ product เดียวกันจริง ซึ่งรวมผู้ผลิต รหัสผลิตภัณฑ์ และความเข้มข้นของรายการเดิม
                </p>
              )}
            </section>
          )}

          {!isHolding && (!isCreate || productMode === 'new') && (
            <section>
              <h3 style={sectionStyle}>ข้อมูลสาร</h3>
              <div style={gridStyle}>
                <Field label="ชื่อสาร *" value={canonicalName} onChange={setCanonicalName} />
                {isCreate && <Field label="ชื่อพ้อง (คั่นด้วยจุลภาค)" value={aliasesText} onChange={setAliasesText} />}
                <Field label="เลขทะเบียน CAS" value={casNumber} onChange={setCasNumber} placeholder="64-19-7" />
                <Field label="ผู้ผลิต" value={manufacturer} onChange={setManufacturer} />
                <Field label="ผู้จำหน่าย" value={supplier} onChange={setSupplier} />
                <Field label="รหัสผลิตภัณฑ์" value={productCode} onChange={setProductCode} />
                <Field label="ความเข้มข้น" value={concentration} onChange={setConcentration} />
                <label>
                  <span style={labelStyle}>สถานะทางกายภาพ</span>
                  <select value={physicalState} onChange={(e) => setPhysicalState(e.target.value)} style={inputStyle}>
                    {PHYSICAL_STATES.map(state => <option key={state || 'none'} value={state}>{state || 'ไม่ระบุ'}</option>)}
                  </select>
                </label>
                {isProduct && (
                  <label>
                    <span style={labelStyle}>สถานะการใช้งาน</span>
                    <select value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value as 'active' | 'retired')} style={inputStyle}>
                      <option value="active">Active</option>
                      <option value="retired">Inactive</option>
                    </select>
                  </label>
                )}
              </div>
            </section>
          )}

          <section>
            <h3 style={sectionStyle}>{isProduct ? 'หน่วยงานที่รับผิดชอบ' : isDepartment ? 'หน่วยงานที่รับผิดชอบ (ไม่มีผังจัดเก็บ)' : 'คลังและตำแหน่งจัดเก็บ'}</h3>
            <div style={gridStyle}>
              <label>
                <span style={labelStyle}>หน่วยงานที่รับผิดชอบ *</span>
                  <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle} disabled={isHolding || isProduct}>
                  {selectableUnits.map(unit => <option key={unit.id} value={unit.id}>{unit.nameTh}</option>)}
                </select>
              </label>
              {isCreate && (
                <label>
                  <span style={labelStyle}>ประเภทจัดเก็บ *</span>
                  <select value={storageScope} onChange={(event) => {
                    const next = event.target.value as 'room' | 'department'
                    setStorageScope(next)
                    if (next === 'department') {
                      setLocationId('')
                      const departmentUnits = units.filter(unit => departmentNames.has(unit.nameTh))
                      if (!departmentUnits.some(unit => unit.id === unitId)) setUnitId(departmentUnits[0]?.id ?? '')
                    }
                  }} style={inputStyle}>
                    <option value="room">ห้องเก็บสารเคมี</option>
                    <option value="department">ตามหน่วยงาน</option>
                  </select>
                </label>
              )}
              {!isProduct && !isDepartment && (
                <label>
                  <span style={labelStyle}>ตำแหน่งจัดเก็บ *</span>
                  <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={inputStyle}>
                    <option value="">เลือกตำแหน่ง</option>
                    {locations.map(location => <option key={location.id} value={location.id}>{location.code}</option>)}
                  </select>
                </label>
              )}
            </div>
            {!isProduct && (
              <div style={{ ...gridStyle, marginTop: SPACE.sm }}>
                <Field label="เลขล็อต" value={lotNumber} onChange={setLotNumber} />
                <Field label={isMeasured ? 'ปริมาณต่อภาชนะ *' : 'ปริมาณคงเหลือ *'} value={packageValue} onChange={setPackageValue} type="number" />
                <label>
                  <span style={labelStyle}>หน่วย *</span>
                  <select
                    value={unitMode === 'custom' ? CUSTOM_UNIT_VALUE : packageUnit}
                    onChange={(e) => {
                      const next = e.target.value
                      if (next === CUSTOM_UNIT_VALUE) { setUnitMode('custom') }
                      else { setUnitMode('preset'); setPackageUnit(next) }
                    }}
                    style={inputStyle}
                  >
                    {PACKAGE_UNIT_SUGGESTIONS.map(unitOption => <option key={unitOption} value={unitOption}>{unitOption}</option>)}
                    <option value={CUSTOM_UNIT_VALUE}>อื่นๆ (ระบุเอง)</option>
                  </select>
                  {unitMode === 'custom' && (
                    <input
                      value={packageUnit}
                      onChange={(e) => setPackageUnit(e.target.value)}
                      style={{ ...inputStyle, marginTop: 6 }}
                      placeholder="พิมพ์หน่วย เช่น test, kit"
                    />
                  )}
                </label>
                {isMeasured && (
                  <Field label="จำนวนภาชนะปัจจุบัน *" value={currentContainerCount} onChange={setCurrentContainerCount} type="number" />
                )}
                <Field label="จำนวนสต๊อกขั้นต่ำ *" value={minimumStock} onChange={setMinimumStock} type="number" />
                {calculatedTotal && (
                  <div style={{ gridColumn: '1 / -1', padding: `${SPACE.xs}px ${SPACE.sm}px`, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--ink)', fontSize: FONT.sm }}>
                    ปริมาณรวมที่คำนวณอัตโนมัติ: <strong>{calculatedTotal.value.toLocaleString('th-TH', { maximumFractionDigits: 6 })} {calculatedTotal.unit}</strong>
                  </div>
                )}
                <Field label="วันที่รับเข้า" value={receivedOn} onChange={setReceivedOn} type="date" />
                <Field label="วันที่เปิดใช้" value={openedOn} onChange={setOpenedOn} type="date" />
                <Field label="วันหมดอายุ" value={expiresOn} onChange={setExpiresOn} type="date" />
                <Field label="วันที่มีผล" value={effectiveOn} onChange={setEffectiveOn} type="date" />
              </div>
            )}
          </section>

          {!isHolding && (!isCreate || productMode === 'new') && (
            <section>
              <h3 style={sectionStyle}>GHS เบื้องต้นสำหรับทะเบียน (ถ้าทราบ)</h3>
              <p style={{ margin: `0 0 ${SPACE.sm}px`, fontSize: FONT.sm, color: 'var(--muted)', lineHeight: 1.55 }}>
                ใช้แสดงและค้นหาสารระหว่างที่ยังไม่มีไฟล์ SDS หากมี SDS ให้ยืนยันรายละเอียดจาก SDS หมวด 2 ในปุ่ม SDS
              </p>
              <label style={{ display: 'block', marginBottom: SPACE.sm }}>
                <span style={labelStyle}>แหล่งข้อมูลเบื้องต้น</span>
                <textarea value={ghsSourceText} onChange={(e) => setGhsSourceText(e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="เช่น ข้อมูลบนฉลาก หรือ SDS ฉบับ/วันที่" />
              </label>
              <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                <legend style={labelStyle}>สัญลักษณ์</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: SPACE.xs }}>
                  {ALL_PICTOGRAMS.map(code => {
                    const checked = pictograms.includes(code)
                    return (
                      <label key={code} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        minHeight: 44, padding: SPACE.xs, borderRadius: 10, cursor: 'pointer',
                        border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                        background: checked ? 'var(--primary-soft)' : 'var(--card)',
                      }}>
                        <input type="checkbox" checked={checked} onChange={() => togglePictogram(code)} style={{ width: 18, height: 18 }} />
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
                      <label style={{ flex: '1 1 200px' }}>
                        <span style={labelStyle}>ประเภท (ไทย)</span>
                        <input value={row.classTh} onChange={(e) => {
                          const next = [...hazards]; next[index] = { ...row, classTh: e.target.value }; setHazards(next)
                        }} style={inputStyle} />
                      </label>
                      <label style={{ flex: '1 1 200px' }}>
                        <span style={labelStyle}>Class (English)</span>
                        <input value={row.classEn} onChange={(e) => {
                          const next = [...hazards]; next[index] = { ...row, classEn: e.target.value }; setHazards(next)
                        }} style={inputStyle} />
                      </label>
                      <Button variant="ghost" icon="trash" size="lg" title="ลบรายการนี้" onClick={() => setHazards(hazards.filter((_, i) => i !== index))} />
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: SPACE.xs }}>
                  <Button variant="soft" icon="plus" onClick={() => setHazards([...hazards, { classTh: '', classEn: '' }])}>เพิ่มรายการ</Button>
                </div>
              </fieldset>
            </section>
          )}

          {error && (
            <p role="alert" style={{
              margin: 0, padding: SPACE.xs, borderRadius: 8, fontSize: FONT.base,
              background: 'rgba(220,38,38,.10)', color: 'var(--danger)', fontWeight: 600,
            }}>
              <Icon name="alert" size={13} /> {error}
            </p>
          )}
        </div>

        <footer style={{ padding: SPACE.md, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: SPACE.xs }}>
          <Button variant="secondary" size="lg" onClick={onClose} disabled={busy}>ยกเลิก</Button>
          <Button icon="arrowRight" size="lg" onClick={submit} disabled={busy}>
            {busy ? 'กำลังบันทึก…' : 'บันทึก'}
          </Button>
        </footer>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} style={inputStyle} />
    </label>
  )
}
