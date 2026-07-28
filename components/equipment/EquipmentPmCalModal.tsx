'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { PdfViewerModal } from '@/components/documents/PdfViewerModal'
import { Icon } from '@/components/ui/Icon'
import { getCurrentThaiFiscalYear } from '@/lib/kpi-utils'
import {
  compareByFiscalMonth,
  computePmCalPlanState,
  fiscalYearForDate,
  fiscalYearMonthToCalendarYear,
  FISCAL_MONTH_ORDER,
  bangkokIsoDate,
  type PmCalPlanRecord,
  type PmCalPlanState,
  type PmCalResult,
  type PmCalResultRecord,
  type PmCalType,
} from '@/lib/equipment/pm-cal-domain'
import { isPdfLike, viewerFileNameFromPath } from '@/lib/pdf-viewer-utils'
import type { Equipment } from '@/lib/queries/equipment'

interface Plan extends PmCalPlanRecord {
  provider: string | null
  planned_cost: number | null
  source: 'manual' | 'legacy_import'
  plan_group_id: string | null
}

interface PlanGroup { id: string; plan_name: string; group_name: string; price_mode: 'per_unit' | 'lump_sum' }

interface Result extends PmCalResultRecord {
  fiscal_year: number
  tech_group: string | null
  certificate_no: string | null
  error_value: string | null
  uncertainty: string | null
  certificate_file_url: string | null
  actual_cost: number | null
  notes: string | null
  source: 'manual' | 'legacy_import'
  created_at: string | null
}

interface ApiPayload {
  fiscal_year: number
  plans: Plan[]
  results: Result[]
  groups: PlanGroup[]
  legacy: Equipment['pm_cal_data']
}

interface ResultForm {
  completed_date: string
  result: PmCalResult
  tech_group: string
  certificate_no: string
  error_value: string
  uncertainty: string
  remark: string
  actual_cost: string
}

type ViewerState = { url: string; pdfJsUrl?: string | null; title: string }

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
const HISTORY_PAGE_SIZE = 10
const STATE_LABEL: Record<PmCalPlanState, string> = { completed: 'เสร็จแล้ว', failed: 'FAIL', due_soon: 'ใกล้กำหนด', overdue: 'เกินกำหนด', ok: 'ตามแผน' }
const STATE_COLOR: Record<PmCalPlanState, string> = { completed: '#15803D', failed: '#B91C1C', due_soon: '#B45309', overdue: '#B91C1C', ok: '#1E5FAD' }

function formatDate(value: string | null) {
  if (!value) return '—'
  const [year, month, day] = value.split('-').map(Number)
  if (!year || !month || !day) return value
  return new Date(year, month - 1, day).toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function lastDayOfFiscalMonth(fiscalYear: number, month: number) {
  const year = fiscalYearMonthToCalendarYear(fiscalYear, month)
  const day = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function emptyResultForm(plan: Plan): ResultForm {
  return {
    completed_date: bangkokIsoDate(),
    result: plan.cal_type === 'CAL' ? 'PASS' : null,
    tech_group: plan.provider ?? '',
    certificate_no: '', error_value: '', uncertainty: '', remark: '', actual_cost: '',
  }
}

export function EquipmentPmCalModal({ item, canEdit, onClose, onSaved }: {
  item: Equipment
  canEdit: boolean
  onClose: () => void
  onSaved: (updated: Equipment) => void
}) {
  const currentFiscalYear = getCurrentThaiFiscalYear()
  const [fiscalYear, setFiscalYear] = useState(currentFiscalYear)
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [provider, setProvider] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [resultPlan, setResultPlan] = useState<Plan | null>(null)
  const [resultForm, setResultForm] = useState<ResultForm | null>(null)
  const [editingResult, setEditingResult] = useState<Result | null>(null)
  const [certificate, setCertificate] = useState<File | null>(null)
  const [certDragOver, setCertDragOver] = useState(false)
  const certificateInputRef = useRef<HTMLInputElement>(null)
  const [attachDragOverId, setAttachDragOverId] = useState<string | null>(null)
  const [viewer, setViewer] = useState<ViewerState | null>(null)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [allHistoryResults, setAllHistoryResults] = useState<Result[] | null>(null)
  const [allHistoryLoading, setAllHistoryLoading] = useState(false)
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(HISTORY_PAGE_SIZE)

  async function load() {
    setLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/equipment/${item.id}/pm-cal?fiscalYear=${fiscalYear}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'โหลดข้อมูล PM/CAL ไม่สำเร็จ')
      setPayload(json)
      setPlans(json.plans)
      setProvider(json.plans.find((plan: Plan) => plan.provider)?.provider ?? json.legacy?.tech_group ?? '')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูล PM/CAL ไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  async function loadAllHistory() {
    setAllHistoryLoading(true); setError('')
    try {
      const response = await fetch(`/api/admin/equipment/${item.id}/pm-cal?fiscalYear=${fiscalYear}&allHistory=1`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'โหลดประวัติทั้งหมดไม่สำเร็จ')
      setAllHistoryResults(json.results)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดประวัติทั้งหมดไม่สำเร็จ')
    } finally {
      setAllHistoryLoading(false)
    }
  }

  useEffect(() => { void load() }, [item.id, fiscalYear]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (showAllHistory) void loadAllHistory() }, [showAllHistory, item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setVisibleHistoryCount(HISTORY_PAGE_SIZE) }, [showAllHistory, item.id, fiscalYear])

  const resultRecords = useMemo(() => (payload?.results ?? []) as PmCalResultRecord[], [payload])
  const displayedResults = showAllHistory ? (allHistoryResults ?? []) : (payload?.results ?? [])
  const planById = useMemo(() => new Map(plans.map(plan => [plan.id, plan])), [plans])
  const groupById = useMemo(() => new Map((payload?.groups ?? []).map(group => [group.id, group])), [payload])
  const hasGroupedPlan = plans.some(plan => plan.plan_group_id)

  function togglePlan(month: number, calType: PmCalType) {
    const existing = plans.find(plan => plan.calendar_month === month && plan.cal_type === calType)
    if (existing) {
      setPlans(current => current.filter(plan => plan !== existing))
      return
    }
    setPlans(current => [...current, {
      id: `new-${calType}-${month}`,
      equipment_id: item.id,
      fiscal_year: fiscalYear,
      calendar_month: month,
      cal_type: calType,
      due_date: lastDayOfFiscalMonth(fiscalYear, month),
      provider: provider || null,
      planned_cost: null,
      record_status: 'active',
      source: 'manual',
      plan_group_id: null,
      version: 1,
    }])
  }

  async function savePlans() {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/admin/equipment/${item.id}/pm-cal`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fiscal_year: fiscalYear,
          expected_versions: Object.fromEntries((payload?.plans ?? []).map(plan => [plan.id, plan.version])),
          plans: plans.map(plan => ({
            calendar_month: plan.calendar_month,
            cal_type: plan.cal_type,
            due_date: plan.due_date,
            provider: provider || null,
            planned_cost: plan.planned_cost,
            version: plan.id.startsWith('new-') ? null : plan.version,
          })),
        }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'บันทึกแผนไม่สำเร็จ')
      setPlans(json.plans)
      onSaved(item)
      await load()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกแผนไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  async function uploadCertificate(created: Result, file: File) {
    const endpoint = `/api/admin/equipment/${item.id}/pm-cal/results/${created.id}/certificate`
    const presign = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: file.name, fileType: file.type, fileSize: file.size }),
    })
    const presignJson = await presign.json()
    if (!presign.ok) throw new Error(presignJson.error ?? 'เตรียมอัปโหลด Certificate ไม่สำเร็จ')
    const upload = await fetch(presignJson.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
    if (!upload.ok) throw new Error('อัปโหลด Certificate ไม่สำเร็จ')
    const finalize = await fetch(endpoint, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: presignJson.key }) })
    const finalizeJson = await finalize.json()
    if (!finalize.ok) throw new Error(finalizeJson.error ?? 'บันทึก Certificate ไม่สำเร็จ')
  }

  function closeResultForm() {
    setResultPlan(null); setResultForm(null); setEditingResult(null); setCertificate(null)
  }

  async function saveResult() {
    if (!resultPlan || !resultForm) return
    setSaving(true); setError('')
    try {
      const endpoint = editingResult
        ? `/api/admin/equipment/${item.id}/pm-cal/results/${editingResult.id}`
        : `/api/admin/equipment/${item.id}/pm-cal/results`
      const response = await fetch(endpoint, {
        method: editingResult ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plan_id: resultPlan.id,
          cal_type: resultPlan.cal_type,
          completed_date: resultForm.completed_date,
          result: resultForm.result,
          tech_group: resultForm.tech_group || null,
          purpose: null, operating_range: null, mpe: null, acceptance_criteria: null,
          certificate_no: resultForm.certificate_no || null,
          error_value: resultForm.error_value || null,
          uncertainty: resultForm.uncertainty || null,
          remark: resultForm.remark || null,
          actual_cost: resultForm.actual_cost ? Number(resultForm.actual_cost) : null,
        }),
      })
      const created = await response.json()
      if (!response.ok) throw new Error(created.error ?? 'บันทึกผลไม่สำเร็จ')
      if (certificate) {
        try {
          await uploadCertificate(created, certificate)
        } catch (cause) {
          closeResultForm()
          onSaved(item)
          await load()
          if (showAllHistory) await loadAllHistory()
          const detail = cause instanceof Error ? cause.message : 'ไม่ทราบสาเหตุ'
          throw new Error(`บันทึกผลแล้ว แต่อัปโหลด Certificate ไม่สำเร็จ: ${detail}`)
        }
      }
      closeResultForm()
      onSaved(item)
      await load()
      if (showAllHistory) await loadAllHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกผลไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  function openEditResult(result: Result, plan: Plan) {
    setResultPlan(plan)
    setResultForm({
      completed_date: result.completed_date ?? bangkokIsoDate(),
      result: result.result,
      tech_group: result.tech_group ?? '',
      certificate_no: result.certificate_no ?? '',
      error_value: result.error_value ?? '',
      uncertainty: result.uncertainty ?? '',
      remark: result.notes ?? '',
      actual_cost: result.actual_cost != null ? String(result.actual_cost) : '',
    })
    setEditingResult(result)
    setCertificate(null)
  }

  async function deleteResult(result: Result) {
    if (!window.confirm(`ลบประวัติ ${result.cal_type} · ${formatDate(result.completed_date)} ถาวร?`)) return
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/admin/equipment/${item.id}/pm-cal/results/${result.id}`, { method: 'DELETE' })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error ?? 'ลบประวัติไม่สำเร็จ')
      onSaved(item)
      await load()
      if (showAllHistory) await loadAllHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบประวัติไม่สำเร็จ')
    } finally { setSaving(false) }
  }

  async function attachCertificate(result: Result, file: File) {
    setSaving(true); setError('')
    try {
      await uploadCertificate(result, file)
      await load()
      if (showAllHistory) await loadAllHistory()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'แนบ Certificate ไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  async function openCertificate(result: Result) {
    if (!result.certificate_file_url) return
    const endpoint = `/api/admin/equipment/${item.id}/pm-cal/results/${result.id}/certificate`
    const response = await fetch(endpoint)
    const json = await response.json()
    if (!response.ok) { setError(json.error ?? 'เปิด Certificate ไม่สำเร็จ'); return }
    if (isPdfLike({ fileName: result.certificate_file_url })) {
      setViewer({ url: json.url, pdfJsUrl: `${endpoint}?proxy=1`, title: viewerFileNameFromPath(result.certificate_file_url) })
    } else window.open(json.url, '_blank', 'noopener,noreferrer')
  }

  const card: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', padding: 16 }
  const input: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13, background: 'var(--card)', color: 'var(--ink)', fontFamily: 'inherit', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', display: 'block' }
  const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--ink)' }
  const btnPrimary: React.CSSProperties = { padding: '9px 16px', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', color: '#fff', background: 'var(--primary)', cursor: 'pointer' }
  const btnGhost: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 7, background: 'var(--card)', color: 'var(--ink)', fontSize: 12.5, fontFamily: 'inherit', padding: '6px 10px', cursor: 'pointer' }
  const btnOutlinePrimary: React.CSSProperties = { border: '1px solid var(--primary)', borderRadius: 7, background: 'transparent', color: 'var(--primary)', fontSize: 12.5, fontWeight: 600, fontFamily: 'inherit', padding: '6px 10px', cursor: 'pointer' }
  const plansInFiscalOrder = useMemo(() => [...plans].sort((a, b) => compareByFiscalMonth(a.calendar_month, b.calendar_month)), [plans])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 18 }}>
      <div style={{ width: 'min(900px,100%)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', background: 'var(--surface)', borderRadius: 16, overflow: 'hidden' }}>
        <header style={{ padding: '16px 20px', background: 'var(--card)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><strong style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{item.equipment_type}</strong><div style={{ fontSize: 12, color: 'var(--primary)' }}>{item.cbh_code ?? '—'} · จัดการ PM/CAL</div></div>
          <button onClick={onClose} aria-label="ปิด" style={{ border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--muted)' }}><Icon name="x" size={20} /></button>
        </header>

        <div style={{ padding: 18, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ padding: 10, borderRadius: 8, background: '#FEF2F2', color: '#B91C1C', fontSize: 13 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap' }}>
            <label style={labelStyle}>ปีงบประมาณ
              <select value={fiscalYear} onChange={event => setFiscalYear(Number(event.target.value))} style={{ ...input, marginTop: 4, minWidth: 130 }}>
                {[currentFiscalYear - 1, currentFiscalYear, currentFiscalYear + 1].map(year => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
            <label style={{ ...labelStyle, flex: 1, minWidth: 220 }}>ผู้ดำเนินการ/บริษัทเริ่มต้น
              <input value={provider} onChange={event => setProvider(event.target.value)} style={{ ...input, marginTop: 4 }} disabled={!canEdit} />
            </label>
            {canEdit && !hasGroupedPlan && <button onClick={savePlans} disabled={saving || loading} style={{ ...btnPrimary, cursor: saving || loading ? 'not-allowed' : 'pointer', opacity: saving || loading ? .7 : 1 }}>{saving ? 'กำลังบันทึก…' : 'บันทึกแผน'}</button>}
          </div>

          {hasGroupedPlan && <div style={{ padding: 10, borderRadius: 8, background: '#EFF6FF', color: '#1E40AF', fontSize: 12 }}>แผนกลุ่มกำหนดวัน ผู้ให้บริการ และราคาไว้จากหน้าแผนสอบเทียบ การบันทึกผลและ Certificate ของเครื่องนี้ยังทำได้ตามปกติ</div>}

          <section style={card}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>แผนรายเดือน ปีงบประมาณ {fiscalYear}</div>
            {loading ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>กำลังโหลด…</div> : (
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
                <thead><tr><th style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>ประเภท</th>{FISCAL_MONTH_ORDER.map(month => <th key={month} style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', padding: 6 }}>{MONTHS[month - 1]}</th>)}</tr></thead>
                <tbody>{(['PM', 'CAL'] as PmCalType[]).map(calType => (
                  <tr key={calType}><td style={{ padding: 8, fontSize: 13, fontWeight: 700 }}>{calType}</td>{FISCAL_MONTH_ORDER.map(month => {
                    const plan = plans.find(value => value.calendar_month === month && value.cal_type === calType)
                    const state = plan ? computePmCalPlanState(plan, resultRecords) : null
                    return <td key={month} style={{ textAlign: 'center', padding: 5 }}>
                      <input type="checkbox" checked={!!plan} disabled={!canEdit || !!plan?.plan_group_id || hasGroupedPlan} onChange={() => togglePlan(month, calType)} title={plan ? `${STATE_LABEL[state!]} · ครบ ${formatDate(plan.due_date)}` : 'ยังไม่มีแผน'} />
                      {plan && <div style={{ fontSize: 10, color: STATE_COLOR[state!], marginTop: 2 }}>{STATE_LABEL[state!]}</div>}
                    </td>
                  })}</tr>
                ))}</tbody>
              </table></div>
            )}
          </section>

          <section style={card}>
            <div style={{ ...sectionTitle, marginBottom: 10 }}>รอบที่ต้องดำเนินการ</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 8 }}>
              {plansInFiscalOrder.map(plan => {
                const state = computePmCalPlanState(plan, resultRecords)
                return <div key={plan.id} style={{ border: '1px solid var(--border)', borderRadius: 9, padding: 10, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div><strong style={{ fontSize: 13 }}>{plan.cal_type} · {MONTHS[plan.calendar_month - 1]}</strong>{plan.plan_group_id && groupById.get(plan.plan_group_id) ? <div style={{ fontSize: 11, color: 'var(--primary)' }}>แผนกลุ่ม: {groupById.get(plan.plan_group_id)?.plan_name}</div> : null}<div style={{ fontSize: 11, color: STATE_COLOR[state] }}>{STATE_LABEL[state]} · {formatDate(plan.due_date)}</div></div>
                  {/* Shown even when already "เสร็จแล้ว": a completed CAL can come from a legacy-imported
                      result with no PASS/FAIL recorded (result: null, treated as done) — legacy rows stay
                      read-only (see history "ลบ"/"แก้ไข" guard below), so if the real certificate turns up
                      later the only way to record the actual PASS/FAIL is to add a new manual result, not
                      edit the legacy one. */}
                  {canEdit && <button onClick={() => { setResultPlan(plan); setResultForm(emptyResultForm(plan)); setEditingResult(null); setCertificate(null) }} style={btnOutlinePrimary}>{state === 'completed' ? 'บันทึกผลเพิ่มเติม' : 'บันทึกผล'}</button>}
                </div>
              })}
              {plans.length === 0 && <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีแผนในปีงบประมาณนี้</div>}
            </div>
          </section>

          <section style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
              <div style={sectionTitle}>ประวัติการดำเนินงาน{showAllHistory ? ' (ทุกปีงบประมาณ)' : ` (ปีงบ ${fiscalYear})`}</div>
              <button
                onClick={() => setShowAllHistory(current => !current)}
                disabled={allHistoryLoading}
                style={{ ...btnGhost, cursor: allHistoryLoading ? 'wait' : 'pointer' }}
              >
                {allHistoryLoading ? 'กำลังโหลด…' : showAllHistory ? `แสดงเฉพาะปีงบ ${fiscalYear}` : 'ดูประวัติทั้งหมด'}
              </button>
            </div>
            {(displayedResults.length === 0) ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>ยังไม่มีประวัติ PM/CAL</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {displayedResults.slice(0, visibleHistoryCount).map(result => {
                  const linked = result.plan_id ? planById.get(result.plan_id) : null
                  const impliedYear = result.completed_date ? fiscalYearForDate(new Date(`${result.completed_date}T00:00:00`)) : null
                  const tone = result.result === 'FAIL' ? '#B91C1C' : result.result === 'PASS' ? '#15803D' : 'var(--muted)'
                  return <div key={result.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div><strong style={{ fontSize: 13 }}>{result.cal_type} · {formatDate(result.completed_date)}</strong> <span style={{ color: tone, fontWeight: 700, fontSize: 12.5 }}>{result.result ?? 'ดำเนินการแล้ว'}</span>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{linked ? `แผน ${MONTHS[linked.calendar_month - 1]} ปีงบ ${linked.fiscal_year}` : result.source === 'legacy_import' ? `ประวัตินำเข้า (ไม่ผูกแผน)${impliedYear ? ` · ปีงบ ${impliedYear}` : ''}` : `ผลจากแผนปีงบประมาณอื่น${impliedYear ? ` (ปีงบ ${impliedYear})` : ''}`}{result.tech_group ? ` · ${result.tech_group}` : ''}</div>
                      {result.notes && <div style={{ fontSize: 12 }}>{result.notes}</div>}
                    </div>
                    <div style={{ alignSelf: 'center', display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      {result.certificate_file_url && <button onClick={() => openCertificate(result)} style={btnGhost}><Icon name="file" size={13} /> Certificate</button>}
                      {canEdit && result.source === 'manual' && !result.certificate_file_url && <label
                        onDragOver={event => { event.preventDefault(); setAttachDragOverId(result.id) }}
                        onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setAttachDragOverId(current => current === result.id ? null : current) }}
                        onDrop={event => {
                          event.preventDefault(); setAttachDragOverId(null)
                          const file = event.dataTransfer.files?.[0]
                          if (file) void attachCertificate(result, file)
                        }}
                        style={{ display: 'inline-block', border: `1px dashed ${attachDragOverId === result.id ? 'var(--primary)' : 'var(--primary)'}`, borderRadius: 7, padding: '4px 8px', background: attachDragOverId === result.id ? 'var(--primary-soft)' : 'transparent', color: 'var(--primary)', cursor: saving ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 600, transition: 'background .15s' }}>
                        {attachDragOverId === result.id ? 'วางไฟล์ที่นี่' : 'แนบ Certificate'}<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" disabled={saving} onChange={event => { const file = event.target.files?.[0]; if (file) void attachCertificate(result, file); event.currentTarget.value = '' }} style={{ display: 'none' }} />
                      </label>}
                      {canEdit && result.source === 'manual' && linked && <button onClick={() => openEditResult(result, linked)} disabled={saving} style={{ ...btnGhost, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>แก้ไข</button>}
                      {canEdit && result.source === 'manual' && <button onClick={() => void deleteResult(result)} disabled={saving} style={{ ...btnGhost, color: '#B91C1C', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .6 : 1 }}>ลบ</button>}
                    </div>
                  </div>
                })}
              </div>
            )}
            {displayedResults.length > visibleHistoryCount && (
              <button
                onClick={() => setVisibleHistoryCount(current => current + HISTORY_PAGE_SIZE)}
                style={{ ...btnGhost, marginTop: 10, width: '100%' }}
              >
                แสดงเพิ่มเติม (เหลืออีก {displayedResults.length - visibleHistoryCount} รายการ)
              </button>
            )}
          </section>
        </div>
      </div>

      {resultPlan && resultForm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ width: 'min(560px,100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--card)', borderRadius: 14, padding: 20 }}>
            <h3 style={{ marginTop: 0, fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>{editingResult ? 'แก้ไขผล PM/CAL' : 'บันทึกผล PM/CAL'} — {resultPlan.cal_type} {MONTHS[resultPlan.calendar_month - 1]}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={labelStyle}>วันที่ดำเนินการ<input type="date" value={resultForm.completed_date} onChange={event => setResultForm({ ...resultForm, completed_date: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>
              <label style={labelStyle}>ผล<select value={resultForm.result ?? ''} onChange={event => setResultForm({ ...resultForm, result: (event.target.value || null) as PmCalResult })} style={{ ...input, marginTop: 4 }}>
                {resultPlan.cal_type === 'PM' && <><option value="">ดำเนินการแล้ว</option><option value="NOT_PERFORMED">NOT_PERFORMED</option></>}
                {resultPlan.cal_type === 'CAL' && <><option value="PASS">PASS</option><option value="FAIL">FAIL</option><option value="NOT_PERFORMED">NOT_PERFORMED</option></>}
              </select></label>
              <label style={{ ...labelStyle, gridColumn: '1/-1' }}>ผู้ดำเนินการ/บริษัท<input value={resultForm.tech_group} onChange={event => setResultForm({ ...resultForm, tech_group: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>
              <label style={labelStyle}>Certificate No.<input value={resultForm.certificate_no} onChange={event => setResultForm({ ...resultForm, certificate_no: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>
              {resultPlan.plan_group_id ? <div style={{ fontSize: 12, color: 'var(--muted)', alignSelf: 'end', paddingBottom: 8 }}>ค่าใช้จ่ายจริงบันทึกเป็นยอดเดียวที่แผนกลุ่ม</div> : <label style={labelStyle}>ค่าใช้จ่ายจริง<input type="number" min="0" value={resultForm.actual_cost} onChange={event => setResultForm({ ...resultForm, actual_cost: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>}
              <label style={labelStyle}>Error<input value={resultForm.error_value} onChange={event => setResultForm({ ...resultForm, error_value: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>
              <label style={labelStyle}>Uncertainty<input value={resultForm.uncertainty} onChange={event => setResultForm({ ...resultForm, uncertainty: event.target.value })} style={{ ...input, marginTop: 4 }} /></label>
              <label style={{ ...labelStyle, gridColumn: '1/-1' }}>หมายเหตุ{resultForm.result === 'NOT_PERFORMED' ? ' (จำเป็น)' : ''}<textarea value={resultForm.remark} onChange={event => setResultForm({ ...resultForm, remark: event.target.value })} style={{ ...input, marginTop: 4, minHeight: 70 }} /></label>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>Certificate</label>
                <input ref={certificateInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" style={{ display: 'none' }}
                  onChange={event => { setCertificate(event.target.files?.[0] ?? null); event.target.value = '' }} />
                <div
                  onDragOver={event => { event.preventDefault(); setCertDragOver(true) }}
                  onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setCertDragOver(false) }}
                  onDrop={event => {
                    event.preventDefault(); setCertDragOver(false)
                    const file = event.dataTransfer.files?.[0]
                    if (file) setCertificate(file)
                  }}
                  style={{ marginTop: 4, borderRadius: 8, border: `2px dashed ${certDragOver ? 'var(--primary)' : 'var(--border)'}`, background: certDragOver ? 'var(--primary-soft)' : 'transparent', transition: 'border-color .15s, background .15s' }}
                >
                  {certificate ? (
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 14px' }}>
                      <Icon name="doc" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12.5, color: certDragOver ? 'var(--primary)' : 'var(--ink)', flex: 1, fontWeight: 500 }}>{certDragOver ? 'วางเพื่อเปลี่ยนไฟล์' : certificate.name}</span>
                      <button type="button" onClick={() => setCertificate(null)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--card)', fontSize: 11.5, fontFamily: 'inherit', cursor: 'pointer', color: 'var(--danger)' }}>ยกเลิก</button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => certificateInputRef.current?.click()} style={{ width: '100%', padding: '16px 14px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: certDragOver ? 'var(--primary)' : 'var(--muted)', fontFamily: 'inherit' }}>
                      <Icon name="upload" size={16} />
                      <span style={{ fontSize: 13 }}>{certDragOver ? 'วางไฟล์ที่นี่' : 'คลิกหรือลากไฟล์มาวาง'}</span>
                      <span style={{ fontSize: 11.5 }}>PDF, JPG, PNG, WEBP</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}><button onClick={closeResultForm} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--ink)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}>ยกเลิก</button><button onClick={saveResult} disabled={saving} style={{ ...btnPrimary, padding: '9px 16px', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'กำลังบันทึก…' : editingResult ? 'บันทึกการแก้ไข' : 'บันทึกผล PM/CAL'}</button></div>
          </div>
        </div>
      )}
      {viewer && <PdfViewerModal url={viewer.url} pdfJsUrl={viewer.pdfJsUrl} title={viewer.title} onClose={() => setViewer(null)} />}
    </div>
  )
}
