'use client'

import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import type { MonthlySafetyPoint, SafetyPointStatus, SafetySupplyRecord, SpillKitItemResult } from '@/lib/quality-tasks/monthly-safety'

type Summary = { total: number; pending: number; overdue: number; submitted: number; issues: number }
type BoardData = { month: string; points: MonthlySafetyPoint[]; summary: Summary }
type TemplateSnapshot = { profile: string; version: number; titleTh: string; items: Record<string, unknown>[]; supplies: SafetySupplyRecord[] }
type FormData = { point: MonthlySafetyPoint; template: TemplateSnapshot; inspection: Record<string, unknown> | null }
type ReplacementDraft = { replace?: boolean; newCode?: string; newLabel?: string; manufacturedOn?: string; purchasedOn?: string; expiresOn?: string; supplier?: string }
type SpillDraft = Record<string, { result: SpillKitItemResult | ''; note: string } & ReplacementDraft>
type NssDraft = Record<string, { clarity: '' | 'clear' | 'turbid'; bottleCondition: '' | 'intact' | 'cracked'; correctiveAction: string } & ReplacementDraft>

const STATUS: Record<SafetyPointStatus, { label: string; tone: string }> = {
  pending: { label: 'ยังไม่ส่ง', tone: 'slate' }, due_soon: { label: 'ใกล้กำหนด', tone: 'amber' },
  overdue: { label: 'เกินกำหนด', tone: 'red' }, submitted: { label: 'ส่งแล้ว', tone: 'green' },
  submitted_with_issues: { label: 'พบปัญหา', tone: 'orange' }, skipped: { label: 'ข้าม', tone: 'slate' },
}
const RESULT_OPTIONS: { value: SpillKitItemResult; label: string }[] = [
  { value: 'normal', label: 'ปกติ' }, { value: 'missing', label: 'ขาด' }, { value: 'damaged', label: 'ชำรุด' },
  { value: 'expired', label: 'หมดอายุ' }, { value: 'na', label: 'ไม่เกี่ยวข้อง' },
]

function currentBangkokMonth() {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'Asia/Bangkok' }).formatToParts(new Date())
  return `${parts.find(part => part.type === 'year')?.value}-${parts.find(part => part.type === 'month')?.value}`
}
function bangkokToday() {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Bangkok' }).format(new Date())
}
function thaiDate(value: string | null) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T00:00:00+07:00`).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}
async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'ดำเนินการไม่สำเร็จ')
  return body as T
}
function profileLabel(profile: string) {
  if (profile === 'nss_eyewash') return 'น้ำยาล้างตา NSS'
  if (profile === 'chemical_spill_kit') return 'Chemical Spill Kit'
  return 'Biohazard Spill Kit'
}

function ReplacementFields({ draft, defaultLabel, onChange }: { draft: ReplacementDraft; defaultLabel: string; onChange: (patch: ReplacementDraft) => void }) {
  return <div className="msb-replacement">
    <label className="msb-replace-check"><input type="checkbox" checked={Boolean(draft.replace)} onChange={event => onChange({ ...draft, replace: event.target.checked, newLabel: draft.newLabel || defaultLabel })} />เปลี่ยนของหรือขวดระหว่างการตรวจ</label>
    {draft.replace && <div className="msb-replace-grid">
      <label><span>รหัสใหม่ *</span><input value={draft.newCode ?? ''} onChange={event => onChange({ ...draft, newCode: event.target.value })} /></label>
      <label><span>ชื่อรายการใหม่</span><input value={draft.newLabel ?? defaultLabel} onChange={event => onChange({ ...draft, newLabel: event.target.value })} /></label>
      <label><span>วันผลิต/บรรจุ</span><input type="date" value={draft.manufacturedOn ?? ''} onChange={event => onChange({ ...draft, manufacturedOn: event.target.value })} /></label>
      <label><span>วันที่ซื้อ</span><input type="date" value={draft.purchasedOn ?? ''} onChange={event => onChange({ ...draft, purchasedOn: event.target.value })} /></label>
      <label><span>วันหมดอายุ</span><input type="date" value={draft.expiresOn ?? ''} onChange={event => onChange({ ...draft, expiresOn: event.target.value })} /></label>
      <label><span>ผู้ขาย</span><input value={draft.supplier ?? ''} onChange={event => onChange({ ...draft, supplier: event.target.value })} /></label>
    </div>}
  </div>
}

export function MonthlySafetyInspectionBoard({ isEditor, fiscalYear }: { isEditor: boolean; fiscalYear: number }) {
  const [month, setMonth] = useState(currentBangkokMonth)
  const [scope, setScope] = useState<'mine' | 'all'>(isEditor ? 'all' : 'mine')
  const [data, setData] = useState<BoardData>({ month, points: [], summary: { total: 0, pending: 0, overdue: 0, submitted: 0, issues: 0 } })
  const [selected, setSelected] = useState<FormData | null>(null)
  const [spillDraft, setSpillDraft] = useState<SpillDraft>({})
  const [nssDraft, setNssDraft] = useState<NssDraft>({})
  const [typeFilter, setTypeFilter] = useState('all')
  const [departmentFilter, setDepartmentFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)

  async function load() {
    setLoading(true); setError('')
    try { setData(await json<BoardData>(await fetch(`/api/admin/safety-tasks/monthly-inspections?month=${month}&scope=${scope}`, { cache: 'no-store' }))) }
    catch (cause) { setError((cause as Error).message) }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [month, scope]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setOnline(navigator.onLine)
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    if (!selected) return
    localStorage.setItem(`monthly-safety-draft:${selected.point.roundItemId}`, JSON.stringify({ spillDraft, nssDraft }))
  }, [nssDraft, selected, spillDraft])

  const departments = useMemo(() => [...new Set(data.points.map(point => point.department).filter(Boolean) as string[])].sort(), [data.points])
  const visible = useMemo(() => data.points.filter(point => {
    if (typeFilter !== 'all' && point.profile !== typeFilter) return false
    if (departmentFilter !== 'all' && point.department !== departmentFilter) return false
    if (statusFilter === 'pending' && !['pending', 'due_soon'].includes(point.status)) return false
    if (statusFilter === 'submitted' && !['submitted', 'submitted_with_issues'].includes(point.status)) return false
    if (statusFilter === 'overdue' && point.status !== 'overdue') return false
    if (statusFilter === 'issues' && point.issueCount < 1) return false
    const q = search.trim().toLocaleLowerCase('th')
    return !q || `${point.assetCode} ${point.assetName} ${point.department ?? ''}`.toLocaleLowerCase('th').includes(q)
  }), [data.points, departmentFilter, search, statusFilter, typeFilter])

  async function openPoint(point: MonthlySafetyPoint) {
    if (!['pending', 'due_soon', 'overdue'].includes(point.status)) return
    setSaving(true); setError('')
    try {
      const form = await json<FormData>(await fetch(`/api/admin/safety-tasks/monthly-inspections/${point.roundItemId}`, { cache: 'no-store' }))
      const stored = localStorage.getItem(`monthly-safety-draft:${point.roundItemId}`)
      const draft = stored ? JSON.parse(stored) as { spillDraft?: SpillDraft; nssDraft?: NssDraft } : null
      const nextSpill = Object.fromEntries((form.template.supplies ?? []).map(supply => [supply.id, { result: '' as const, note: '' }]))
      const nextNss = Object.fromEntries((form.template.supplies ?? []).filter(supply => supply.supplyType === 'nss_bottle').map(supply => [supply.id, { clarity: '' as const, bottleCondition: '' as const, correctiveAction: '' }]))
      setSpillDraft(draft?.spillDraft ?? nextSpill); setNssDraft(draft?.nssDraft ?? nextNss); setSelected(form)
    } catch (cause) { setError((cause as Error).message) }
    finally { setSaving(false) }
  }
  function markAllNormal() {
    const today = bangkokToday()
    setSpillDraft(Object.fromEntries((selected?.template.supplies ?? []).map(supply => [supply.id, {
      result: supply.expiresOn && supply.expiresOn < today ? 'expired' : 'normal',
      note: supply.expiresOn && supply.expiresOn < today ? 'หมดอายุตามทะเบียน' : '',
    }])))
  }
  async function submit() {
    if (!selected || !online) return
    setSaving(true); setError('')
    try {
      const isNss = selected.point.profile === 'nss_eyewash'
      if (!isNss && Object.values(spillDraft).some(answer => !answer.result)) throw new Error('กรุณาเลือกผลตรวจให้ครบทุกข้อ')
      if (isNss && Object.values(nssDraft).some(answer => !answer.clarity || !answer.bottleCondition)) throw new Error('กรุณาตรวจความใสและสภาพขวดให้ครบทุกขวด')
      const replacementDraft = isNss ? nssDraft : spillDraft
      const replacements = selected.template.supplies.filter(supply => replacementDraft[supply.id]?.replace).map(supply => {
        const replacement = replacementDraft[supply.id]
        if (!replacement.newCode?.trim()) throw new Error('รายการที่เปลี่ยนต้องระบุรหัส inventory ใหม่')
        return {
          oldSupplyId: supply.id, internalCode: replacement.newCode.trim(),
          labelTh: replacement.newLabel?.trim() || supply.labelTh,
          manufacturedOrPackedOn: replacement.manufacturedOn || null, purchasedOn: replacement.purchasedOn || null,
          expiresOn: replacement.expiresOn || null, supplier: replacement.supplier?.trim() || null,
        }
      })
      const body = isNss ? {
        kind: 'nss', activeBottleIds: selected.template.supplies.filter(supply => supply.supplyType === 'nss_bottle').map(supply => supply.id),
        bottles: Object.entries(nssDraft).map(([supplyId, answer]) => ({ supplyId, clarity: answer.clarity, bottleCondition: answer.bottleCondition, correctiveAction: answer.correctiveAction || null })),
        replacements,
      } : {
        kind: 'spill_kit', inspectedOn: bangkokToday(),
        answers: selected.template.supplies.map(supply => ({ supplyId: supply.id, itemKey: String(selected.template.items?.find(item => item.id === supply.templateItemId)?.itemKey ?? supply.internalCode), result: spillDraft[supply.id]?.result, expiresOn: supply.expiresOn, note: spillDraft[supply.id]?.note || null })),
        replacements,
      }
      await json(await fetch(`/api/admin/safety-tasks/monthly-inspections/${selected.point.roundItemId}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
      localStorage.removeItem(`monthly-safety-draft:${selected.point.roundItemId}`); setSelected(null); await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setSaving(false) }
  }
  async function skipPoint() {
    if (!selected || !isEditor) return
    const reason = window.prompt('เหตุผลที่ข้ามจุดตรวจ (จะถูกบันทึกใน audit log)')?.trim()
    if (!reason) return
    setSaving(true); setError('')
    try {
      await json(await fetch(`/api/admin/safety-tasks/monthly-inspections/${selected.point.roundItemId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'skip', reason }) }))
      localStorage.removeItem(`monthly-safety-draft:${selected.point.roundItemId}`); setSelected(null); await load()
    } catch (cause) { setError((cause as Error).message) }
    finally { setSaving(false) }
  }

  return <section className="msb">
    <header className="msb-head">
      <div><span className="msb-kicker">MONTHLY INSPECTIONS</span><h2>ตรวจ Spill Kit และน้ำยาล้างตา NSS</h2><p>เปิดรอบวันที่ 1 · เตือนล่วงหน้า 5 วัน · ครบกำหนดวันที่ 15 ของทุกเดือน</p></div>
      <div className="msb-actions">
        <a className="msb-download" href={`/api/admin/safety-tasks/monthly-inspections/report?fiscalYear=${fiscalYear}&month=${month}`}><Icon name="download" size={15} />PDF เดือนนี้</a>
        <a className="msb-download is-primary" href={`/api/admin/safety-tasks/monthly-inspections/report?fiscalYear=${fiscalYear}`}><Icon name="download" size={15} />PDF ปีงบประมาณ</a>
      </div>
    </header>
    {!online && <div className="msb-offline"><Icon name="alert" size={15} />ออฟไลน์ — แบบร่างยังอยู่ในเครื่อง และจะส่งได้เมื่อกลับมาออนไลน์</div>}
    {error && <div className="msb-error" role="alert">{error}<button onClick={() => setError('')} aria-label="ปิด">×</button></div>}
    <div className="msb-summary">
      {[['ทั้งหมด', data.summary.total, 'neutral'], ['ยังไม่ส่ง', data.summary.pending, 'slate'], ['ส่งแล้ว', data.summary.submitted, 'green'], ['เกินกำหนด', data.summary.overdue, 'red'], ['พบปัญหา', data.summary.issues, 'orange']].map(([label, value, tone]) => <article className={`is-${tone}`} key={String(label)}><strong>{value}</strong><span>{label}</span></article>)}
    </div>
    <div className="msb-toolbar">
      <div className="msb-scope"><button className={scope === 'mine' ? 'active' : ''} onClick={() => setScope('mine')}>งานของฉัน</button>{isEditor && <button className={scope === 'all' ? 'active' : ''} onClick={() => setScope('all')}>ทุกจุด</button>}</div>
      <label><span>เดือน</span><input type="month" value={month} onChange={event => setMonth(event.target.value)} /></label>
      <label><span>ชนิด</span><select value={typeFilter} onChange={event => setTypeFilter(event.target.value)}><option value="all">ทุกชนิด</option><option value="biohazard_spill_kit">Biohazard Spill Kit</option><option value="chemical_spill_kit">Chemical Spill Kit</option><option value="nss_eyewash">NSS</option></select></label>
      <label><span>หน่วยงาน</span><select value={departmentFilter} onChange={event => setDepartmentFilter(event.target.value)}><option value="all">ทุกหน่วยงาน</option>{departments.map(department => <option key={department}>{department}</option>)}</select></label>
      <label><span>สถานะ</span><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">ทุกสถานะ</option><option value="pending">ยังไม่ส่ง</option><option value="submitted">ส่งแล้ว</option><option value="overdue">เกินกำหนด</option><option value="issues">พบปัญหา</option></select></label>
      <label className="msb-search"><span>จุดตรวจ</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหารหัสหรือชื่อจุด" /></label>
    </div>
    <div className="msb-list" aria-busy={loading}>
      {loading ? <div className="msb-empty">กำลังเตรียมรอบตรวจประจำเดือน…</div> : visible.map(point => <button key={point.roundItemId} className="msb-row" onClick={() => void openPoint(point)} disabled={!['pending', 'due_soon', 'overdue'].includes(point.status)}>
        <span className="msb-type">{point.profile === 'nss_eyewash' ? 'NSS' : 'SPILL'}</span>
        <span className="msb-main"><strong>{point.assetCode} · {point.assetName}</strong><small>{profileLabel(point.profile)}{point.department ? ` · ${point.department}` : ''}</small></span>
        <span className="msb-people">{point.assignments.map(item => item.userName ?? 'ไม่ระบุชื่อ').join(', ') || 'ยังไม่มอบหมาย'}</span>
        <time>ครบกำหนด {thaiDate(point.dueOn)}</time><span className={`msb-status is-${STATUS[point.status].tone}`}>{STATUS[point.status].label}</span><Icon name="arrowRight" size={14} />
      </button>)}
      {!loading && !visible.length && <div className="msb-empty">ไม่พบจุดตรวจตามตัวกรอง หรือยังไม่ได้กำหนด profile/ผู้รับผิดชอบใน Safety Asset</div>}
    </div>

    {selected && <div className="msb-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null) }}>
      <section className="msb-dialog" role="dialog" aria-modal="true" aria-labelledby="msb-form-title">
        <header><div><span>{profileLabel(selected.point.profile)} · Version {selected.template.version}</span><h3 id="msb-form-title">{selected.point.assetCode} · {selected.point.assetName}</h3></div><button onClick={() => setSelected(null)} aria-label="ปิดฟอร์ม">×</button></header>
        <div className="msb-form-body">
          {selected.point.profile !== 'nss_eyewash' ? <>
            <div className="msb-form-intro"><p>ตรวจรายการทุกข้อ ของที่หมดอายุแล้วไม่สามารถบันทึกเป็น “ปกติ” ได้</p><button onClick={markAllNormal}><Icon name="check" size={14} />ปกติทั้งหมด</button></div>
            <div className="msb-spill-items">{selected.template.supplies.map((supply, index) => {
              const answer = spillDraft[supply.id] ?? { result: '', note: '' }
              const expired = Boolean(supply.expiresOn && supply.expiresOn < bangkokToday())
              return <article key={supply.id} className={answer.result && !['normal', 'na'].includes(answer.result) ? 'is-issue' : ''}>
                <div className="msb-item-title"><b>{index + 1}. {supply.labelTh}</b><small>รหัส {supply.internalCode} · หมดอายุ {thaiDate(supply.expiresOn)}{expired ? ' · หมดอายุแล้ว' : ''}</small></div>
                <select aria-label={`ผลตรวจ ${supply.labelTh}`} value={answer.result} onChange={event => setSpillDraft(current => ({ ...current, [supply.id]: { ...answer, result: event.target.value as SpillKitItemResult } }))}><option value="">เลือกผลตรวจ</option>{RESULT_OPTIONS.map(option => <option key={option.value} value={option.value} disabled={expired && option.value === 'normal'}>{option.label}</option>)}</select>
                {!['', 'normal', 'na'].includes(answer.result) && <><textarea value={answer.note} onChange={event => setSpillDraft(current => ({ ...current, [supply.id]: { ...answer, note: event.target.value } }))} placeholder="รายละเอียดและการแก้ไขปัญหา" /><ReplacementFields draft={answer} defaultLabel={supply.labelTh} onChange={patch => setSpillDraft(current => ({ ...current, [supply.id]: { ...answer, ...patch } }))} /></>}
              </article>
            })}</div>
          </> : <div className="msb-nss-items">{selected.template.supplies.filter(supply => supply.supplyType === 'nss_bottle').map((supply, index) => {
            const answer = nssDraft[supply.id] ?? { clarity: '', bottleCondition: '', correctiveAction: '' }
            const expired = Boolean(supply.expiresOn && supply.expiresOn < bangkokToday())
            const abnormal = answer.clarity === 'turbid' || answer.bottleCondition === 'cracked' || expired
            return <article key={supply.id} className={abnormal ? 'is-issue' : ''}><header><b>ขวดที่ {index + 1} · {supply.internalCode}</b><small>ผลิต/บรรจุ {thaiDate(supply.manufacturedOrPackedOn)} · หมดอายุ {thaiDate(supply.expiresOn)}{expired ? ' · หมดอายุแล้ว' : ''} · ผู้ขาย {supply.supplier || '—'}</small></header>
              <div><label><span>ความใส</span><select value={answer.clarity} onChange={event => setNssDraft(current => ({ ...current, [supply.id]: { ...answer, clarity: event.target.value as NssDraft[string]['clarity'] } }))}><option value="">เลือก</option><option value="clear">ใส</option><option value="turbid">ขุ่น</option></select></label><label><span>สภาพขวด</span><select value={answer.bottleCondition} onChange={event => setNssDraft(current => ({ ...current, [supply.id]: { ...answer, bottleCondition: event.target.value as NssDraft[string]['bottleCondition'] } }))}><option value="">เลือก</option><option value="intact">สมบูรณ์</option><option value="cracked">มีรอยร้าว</option></select></label></div>
              {abnormal && <><textarea value={answer.correctiveAction} onChange={event => setNssDraft(current => ({ ...current, [supply.id]: { ...answer, correctiveAction: event.target.value } }))} placeholder="การแก้ไขปัญหา (จำเป็น)" /><ReplacementFields draft={answer} defaultLabel={supply.labelTh} onChange={patch => setNssDraft(current => ({ ...current, [supply.id]: { ...answer, ...patch } }))} /></>}
            </article>
          })}</div>}
        </div>
        <footer>{isEditor && <button className="msb-skip" onClick={() => void skipPoint()} disabled={saving}>ข้ามจุดพร้อมเหตุผล</button>}<span>แบบร่างบันทึกในเครื่องอัตโนมัติ</span><button className="msb-submit" onClick={() => void submit()} disabled={saving || !online}>{saving ? 'กำลังบันทึก…' : 'ยืนยันส่งผลตรวจ'}</button></footer>
      </section>
    </div>}
    <style jsx>{`
      .msb{--msb:#0f766e;--ink:var(--foreground,#172033);--muted:var(--muted-foreground,#64748b);display:flex;flex-direction:column;gap:14px}.msb-head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start}.msb-head h2{margin:2px 0 4px;font-size:22px}.msb-head p{margin:0;color:var(--muted);font-size:12px}.msb-kicker{color:var(--msb);font-size:10px;font-weight:900;letter-spacing:.14em}.msb-actions{display:flex;gap:7px}.msb-download{display:inline-flex;align-items:center;gap:6px;min-height:44px;padding:0 13px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--ink);font-size:11px;font-weight:800;text-decoration:none}.msb-download.is-primary{border-color:var(--msb);background:var(--msb);color:white}.msb-offline,.msb-error{display:flex;align-items:center;gap:7px;padding:10px 12px;border-radius:9px;background:#fffbeb;color:#92400e;font-size:12px}.msb-error{background:#fef2f2;color:#b91c1c}.msb-error button{margin-left:auto;border:0;background:none;color:inherit;font-size:18px}.msb-summary{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.msb-summary article{display:flex;align-items:center;gap:9px;padding:12px;border:1px solid var(--border);border-left:3px solid #64748b;border-radius:9px;background:var(--card)}.msb-summary strong{font-size:22px}.msb-summary span{color:var(--muted);font-size:11px}.msb-summary .is-green{border-left-color:#059669}.msb-summary .is-red{border-left-color:#dc2626}.msb-summary .is-orange{border-left-color:#ea580c}.msb-toolbar{display:flex;align-items:end;gap:8px;padding:10px;border:1px solid var(--border);border-radius:11px;background:var(--card)}.msb-toolbar label{display:flex;flex-direction:column;gap:3px}.msb-toolbar label>span{color:var(--muted);font-size:9px;font-weight:750}.msb-toolbar :is(input,select),.msb-scope button{min-height:44px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:11px;padding:0 10px}.msb-scope{display:flex}.msb-scope button{border-radius:0}.msb-scope button:first-child{border-radius:8px 0 0 8px}.msb-scope button:last-child{border-radius:0 8px 8px 0}.msb-scope .active{border-color:var(--msb);background:#ecfdf5;color:#047857;font-weight:800}.msb-search{flex:1}.msb-search input{width:100%;box-sizing:border-box}.msb-list{overflow:hidden;border:1px solid var(--border);border-radius:11px;background:var(--card)}.msb-row{display:grid;grid-template-columns:54px minmax(190px,1.4fr) minmax(130px,.8fr) 105px 84px 15px;align-items:center;gap:10px;width:100%;min-height:64px;padding:10px 13px;border:0;border-bottom:1px solid var(--border);background:transparent;color:var(--ink);font:inherit;text-align:left}.msb-row:not(:disabled){cursor:pointer}.msb-row:not(:disabled):hover{background:color-mix(in srgb,var(--msb) 5%,var(--card))}.msb-row:disabled{opacity:.75}.msb-type{display:grid;place-items:center;min-height:28px;border-radius:6px;background:#ecfeff;color:#0e7490;font-size:9px;font-weight:900}.msb-main{display:flex;flex-direction:column}.msb-main strong{font-size:12px}.msb-main small,.msb-people,.msb-row time{color:var(--muted);font-size:10px}.msb-status{display:inline-flex;justify-content:center;padding:5px;border-radius:999px;font-size:9px;font-weight:850}.msb-status.is-green{background:#ecfdf5;color:#047857}.msb-status.is-red{background:#fef2f2;color:#b91c1c}.msb-status.is-orange{background:#fff7ed;color:#c2410c}.msb-status.is-amber{background:#fffbeb;color:#a16207}.msb-status.is-slate{background:#f1f5f9;color:#475569}.msb-empty{padding:32px;text-align:center;color:var(--muted);font-size:12px}.msb-backdrop{position:fixed;z-index:70;inset:0;background:rgba(15,23,42,.48);backdrop-filter:blur(2px)}.msb-dialog{position:absolute;top:0;right:0;display:flex;flex-direction:column;width:min(720px,100vw);height:100%;background:var(--card);box-shadow:-20px 0 60px rgba(15,23,42,.2)}.msb-dialog>header{display:flex;justify-content:space-between;padding:18px 22px;border-bottom:1px solid var(--border)}.msb-dialog>header span{color:var(--msb);font-size:9px;font-weight:850}.msb-dialog h3{margin:3px 0;font-size:18px}.msb-dialog>header button{width:44px;height:44px;border:0;border-radius:9px;background:var(--surface-2);color:var(--ink);font-size:22px}.msb-form-body{flex:1;overflow:auto;padding:18px 22px}.msb-form-intro{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px;border-radius:9px;background:#f0fdfa}.msb-form-intro p{margin:0;color:#115e59;font-size:11px}.msb-form-intro button{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 12px;border:0;border-radius:8px;background:var(--msb);color:white;font-weight:800}.msb-spill-items,.msb-nss-items{display:flex;flex-direction:column;gap:8px;margin-top:10px}.msb-spill-items article{display:grid;grid-template-columns:minmax(180px,1fr) 150px;gap:8px;padding:11px;border:1px solid var(--border);border-radius:9px}.msb-spill-items article.is-issue,.msb-nss-items article.is-issue{border-color:#fdba74;background:#fff7ed}.msb-item-title{display:flex;flex-direction:column}.msb-item-title b{font-size:11px}.msb-item-title small,.msb-nss-items small{color:var(--muted);font-size:9px}.msb-spill-items :is(select,textarea),.msb-nss-items :is(select,textarea){min-height:44px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--ink);font:inherit;font-size:11px}.msb-spill-items textarea{grid-column:1/-1;resize:vertical}.msb-nss-items article{padding:12px;border:1px solid var(--border);border-radius:9px}.msb-nss-items article>header{display:flex;flex-direction:column;margin-bottom:9px}.msb-nss-items article>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.msb-nss-items label{display:flex;flex-direction:column;gap:3px}.msb-nss-items label span{font-size:9px;font-weight:750}.msb-nss-items textarea{width:100%;margin-top:8px;box-sizing:border-box}.msb-dialog>footer{display:flex;align-items:center;gap:9px;padding:12px 22px;border-top:1px solid var(--border)}.msb-dialog>footer span{flex:1;color:var(--muted);font-size:9px}.msb-dialog>footer button{min-height:44px;padding:0 14px;border-radius:8px;font:inherit;font-size:11px;font-weight:850}.msb-submit{border:0;background:var(--msb);color:white}.msb-skip{border:1px solid #fca5a5;background:#fff;color:#b91c1c}
      .msb-replacement{grid-column:1/-1!important;display:block!important;padding:9px;border:1px dashed #fb923c;border-radius:8px}.msb-replace-check{display:flex!important;flex-direction:row!important;align-items:center;gap:7px;font-size:10px;font-weight:800}.msb-replace-check input{width:20px;min-height:20px}.msb-replace-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px;margin-top:8px}.msb-replace-grid label{display:flex;flex-direction:column;gap:3px}.msb-replace-grid label span{font-size:9px;font-weight:750}.msb-replace-grid input{min-height:44px;padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--ink);font:inherit}
      @media(max-width:1023px){.msb-toolbar{flex-wrap:wrap}.msb-search{min-width:220px}.msb-row{grid-template-columns:50px minmax(190px,1fr) 100px 82px 15px}.msb-people{display:none}}
      @media(max-width:767px){.msb-head{display:block;padding:0 2px}.msb-actions{margin-top:10px;overflow-x:auto}.msb-download{white-space:nowrap}.msb-summary{grid-template-columns:repeat(2,1fr)}.msb-summary article:first-child{grid-column:1/-1}.msb-toolbar{display:grid;grid-template-columns:1fr 1fr}.msb-scope,.msb-search{grid-column:1/-1}.msb-scope button{flex:1}.msb-toolbar label :is(input,select){width:100%;box-sizing:border-box}.msb-row{grid-template-columns:45px minmax(0,1fr) 76px 14px;min-height:72px;padding:10px}.msb-row time,.msb-people{display:none}.msb-main strong{white-space:normal}.msb-dialog>header,.msb-form-body,.msb-dialog>footer{padding-left:14px;padding-right:14px}.msb-spill-items article{grid-template-columns:1fr}.msb-spill-items textarea{grid-column:auto}.msb-replace-grid{grid-template-columns:1fr!important}.msb-dialog>footer{flex-wrap:wrap}.msb-dialog>footer span{order:-1;flex-basis:100%}.msb-dialog>footer button{flex:1}}
    `}</style>
  </section>
}
