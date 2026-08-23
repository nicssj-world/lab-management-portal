'use client'

import Link from 'next/link'
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import type { QualityTaskActionItem, QualityTaskHoliday, QualityTaskOccurrence, QualityTaskTemplate, SafetyCertificate, TaskStatus } from '@/lib/quality-tasks/types'
import { certificateRenewalWindow, isLinkedQualityOccurrence, linkedQualityTaskHref, missingEvidenceRequirements } from '@/lib/quality-tasks/safety'
import { isWeekendDate } from '@/lib/quality-tasks/logic'
import { isMonthlySafetySourceKey } from '@/lib/quality-tasks/monthly-safety'
import { MonthlySafetyInspectionBoard } from './MonthlySafetyInspectionBoard'
import { SafetyCommitteeManager, type SafetyCommitteeEditor, type SafetyCommitteeStaff } from './SafetyCommitteeManager'

type Tab = 'overview' | 'monthly' | 'tasks' | 'calendar' | 'evidence' | 'certificates'
type Person = { id: string; name: string; dept: string | null; role: string; position_title: string | null }
type EvidenceItem = {
  id: string; instanceId: string | null; sourceKind: 'task' | 'inspection'; downloadHref: string
  fileName: string; contentType: string; sizeBytes: number; uploadedAt: string
  requirementId: string | null; evidenceKind: string; taskTitle: string; referenceCode: string | null; periodLabel: string; fiscalYear: number
  assetKind: string | null; assetCode: string | null; assetName: string | null; taskSourceKey: string | null; inspectedOn: string | null
}
type InspectionEvidenceSummary = { photoCount: number; assetCount: number }
type EvidenceSubgroup = {
  key: string; title: string; referenceCode: string | null; periodLabel: string; sortNumber: number | null; files: EvidenceItem[]
}
type EvidenceGroup = {
  key: string; title: string; subtitle: string; sourceKind: EvidenceItem['sourceKind']; referenceCode: string | null; periodLabel: string; files: EvidenceItem[]; children: EvidenceSubgroup[]
}
type SafetyIntegration = {
  id: string; kind: string; sourceId: string; syncStatus: string; metadata: Record<string, unknown>
  items?: { status: string; inspectionId: string | null; asset: { code?: string; name_th?: string; kind?: string } | null; inspection: { id?: string; result?: string; inspected_on?: string; note?: string | null; photo_file_name?: string } | null }[]
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'ภาพรวม', icon: 'dash' },
  { id: 'monthly', label: 'ตรวจประจำเดือน', icon: 'check' },
  { id: 'tasks', label: 'รายการงาน', icon: 'clipboard' },
  { id: 'calendar', label: 'ปฏิทิน', icon: 'calendar' },
  { id: 'evidence', label: 'หลักฐานประจำปี', icon: 'inbox' },
  { id: 'certificates', label: 'ใบรับรอง', icon: 'shieldCheck' },
]

const STATUS: Record<TaskStatus, { label: string; icon: string; tone: string }> = {
  open: { label: 'ยังไม่เริ่ม', icon: 'clock', tone: 'slate' },
  in_progress: { label: 'กำลังดำเนินการ', icon: 'trending', tone: 'cyan' },
  pending_review: { label: 'รอตรวจทาน', icon: 'eye', tone: 'amber' },
  completed: { label: 'เสร็จสิ้น', icon: 'check', tone: 'teal' },
}

function thaiDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '—'
  return new Date(`${value.slice(0, 10)}T00:00:00+07:00`).toLocaleDateString('th-TH', options ?? { day: 'numeric', month: 'short', year: '2-digit' })
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const item = STATUS[status]
  return <span className={`safety-status is-${item.tone}`}><Icon name={item.icon} size={13} />{item.label}</span>
}

function urgencyLabel(item: QualityTaskOccurrence) {
  if (item.status === 'completed') return 'เสร็จแล้ว'
  if (item.urgency === 'overdue') return 'เกินกำหนด'
  if (item.urgency === 'due-soon') return 'ใกล้ถึงกำหนด'
  return 'ตามแผน'
}

async function json<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? 'ดำเนินการไม่สำเร็จ')
  return body as T
}

function isImageEvidence(file: EvidenceItem) {
  return file.contentType.toLowerCase().startsWith('image/')
}

const SAFETY_ASSET_KIND_LABELS: Record<string, string> = {
  'fire-extinguisher': 'ถังดับเพลิง',
  'fire-hose': 'สายฉีดน้ำดับเพลิง',
  'manual-call-point': 'จุดกดแจ้งเหตุ',
  aed: 'เครื่อง AED',
  'first-aid-kit': 'ชุดปฐมพยาบาล',
  'spill-kit': 'ชุดจัดการสารหกรั่วไหล',
  'nss-eyewash': 'อ่างล้างตาฉุกเฉิน',
  'emergency-shower': 'ฝักบัวฉุกเฉิน',
  'emergency-shutoff': 'จุดตัดระบบฉุกเฉิน',
}

const evidenceCollator = new Intl.Collator('th', { numeric: true, sensitivity: 'base' })

function safetyAssetKindLabel(kind: string | null) {
  if (!kind) return null
  return SAFETY_ASSET_KIND_LABELS[kind] ?? kind
}

function evidenceNumber(value: string | null | undefined) {
  const match = value?.trim().match(/(\d+)\s*$/)
  return match ? Number(match[1]) : null
}

function fallbackEvidenceKindTitle(file: EvidenceItem) {
  const source = file.assetName?.trim() || file.taskTitle.trim() || 'อุปกรณ์ความปลอดภัย'
  return source.replace(/\s*[-#]?\s*\d+\s*$/, '').trim() || source
}

function filterSafetyEvidence(items: EvidenceItem[], query: string) {
  const normalizedQuery = query.trim().toLocaleLowerCase('th')
  if (!normalizedQuery) return items
  return items.filter(file => [
    file.taskTitle,
    file.assetKind,
    safetyAssetKindLabel(file.assetKind),
    file.assetCode,
    file.assetName,
    file.referenceCode,
    file.periodLabel,
    file.fileName,
  ].filter(Boolean).join(' ').toLocaleLowerCase('th').includes(normalizedQuery))
}

function groupSafetyEvidence(items: EvidenceItem[]): EvidenceGroup[] {
  const groups = new Map<string, EvidenceGroup>()
  for (const file of items) {
    const isInspection = file.sourceKind === 'inspection'
    const title = isInspection ? safetyAssetKindLabel(file.assetKind) ?? fallbackEvidenceKindTitle(file) : file.taskTitle.trim() || 'หลักฐานงาน'
    const key = isInspection ? `inspection-kind:${file.assetKind ?? title}` : `task:${title}:${file.referenceCode ?? ''}`
    const existing = groups.get(key) ?? {
      key,
      title,
      subtitle: isInspection ? 'ประเภทอุปกรณ์ความปลอดภัย' : `${file.referenceCode ?? 'Safety Task'} · ${file.periodLabel}`,
      sourceKind: file.sourceKind,
      referenceCode: file.referenceCode,
      periodLabel: file.periodLabel,
      files: [],
      children: [],
    }
    const childTitle = isInspection ? file.assetName?.trim() || file.taskTitle.trim() || 'อุปกรณ์ความปลอดภัย' : file.periodLabel || 'หลักฐานประจำงวด'
    const childKey = isInspection ? `inspection-asset:${file.assetCode ?? childTitle}` : `task-period:${title}:${file.referenceCode ?? ''}:${file.periodLabel}`
    const child = existing.children.find(item => item.key === childKey)
    if (child) child.files.push(file)
    else existing.children.push({
      key: childKey,
      title: childTitle,
      referenceCode: file.referenceCode,
      periodLabel: file.periodLabel,
      sortNumber: isInspection ? evidenceNumber(file.assetCode) ?? evidenceNumber(file.assetName) ?? evidenceNumber(childTitle) : null,
      files: [file],
    })
    existing.files.push(file)
    groups.set(key, existing)
  }
  return [...groups.values()].map(group => ({
    ...group,
    children: [...group.children].map(child => ({
      ...child,
      files: [...child.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    })).sort((a, b) => {
      if (a.sortNumber !== null && b.sortNumber !== null && a.sortNumber !== b.sortNumber) return a.sortNumber - b.sortNumber
      if (a.sortNumber !== null && b.sortNumber === null) return -1
      if (a.sortNumber === null && b.sortNumber !== null) return 1
      return evidenceCollator.compare(a.title, b.title)
    }),
    files: [...group.files].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
  })).sort((a, b) => {
    if (a.sourceKind !== b.sourceKind) return a.sourceKind === 'inspection' ? -1 : 1
    return evidenceCollator.compare(a.title, b.title)
  })
}

function evidenceGroupKeys(groups: EvidenceGroup[]) {
  return groups.flatMap(group => [group.key, ...group.children.map(child => child.key)])
}

function linkedTaskForEvidence(file: EvidenceItem, occurrences: QualityTaskOccurrence[]) {
  if (file.instanceId) return occurrences.find(item => item.instanceId === file.instanceId)
  if (file.sourceKind !== 'inspection' || !file.taskSourceKey || !file.inspectedOn) return undefined
  return occurrences.find(item => item.template.sourceKey === file.taskSourceKey
    && item.template.integrationKind === 'safety_inspection'
    && item.periodStart <= file.inspectedOn!
    && item.periodEnd >= file.inspectedOn!)
}

function summarizeInspectionEvidence(items: EvidenceItem[], occurrence: QualityTaskOccurrence | null): InspectionEvidenceSummary {
  if (!occurrence || occurrence.template.integrationKind !== 'safety_inspection') return { photoCount: 0, assetCount: 0 }
  const matching = items.filter(file => file.sourceKind === 'inspection'
    && file.taskSourceKey === occurrence.template.sourceKey
    && Boolean(file.inspectedOn)
    && file.inspectedOn! >= occurrence.periodStart
    && file.inspectedOn! <= occurrence.periodEnd)
  const latestByAsset = new Map<string, EvidenceItem>()
  for (const file of matching) {
    const key = file.assetCode ?? file.id
    const current = latestByAsset.get(key)
    if (!current || `${file.inspectedOn}|${file.uploadedAt}` > `${current.inspectedOn}|${current.uploadedAt}`) latestByAsset.set(key, file)
  }
  return { photoCount: matching.length, assetCount: latestByAsset.size }
}

function EvidenceFileCard({ file, linkedTask, onOpenImage, onOpenTask }: {
  file: EvidenceItem
  linkedTask: QualityTaskOccurrence | undefined
  onOpenImage: (file: EvidenceItem) => void
  onOpenTask: (item: QualityTaskOccurrence) => void
}) {
  const image = isImageEvidence(file)
  const meta = `${file.referenceCode ?? file.periodLabel} · ${(file.sizeBytes / 1024 / 1024).toFixed(1)} MB`
  return <article className={`safety-evidence-card${image ? ' is-image' : ''}`}>
    {image && <button type="button" className="safety-evidence-preview" onClick={() => onOpenImage(file)} aria-label={`เปิดรูปหลักฐาน ${file.taskTitle}`}>
      <img src={file.downloadHref} alt={`รูปหลักฐาน ${file.taskTitle}`} loading="lazy" />
      <span><Icon name="eye" size={14} />เปิดดูรูป</span>
    </button>}
    <div className="safety-evidence-file-row">
      {!image && <span className={`safety-file-icon is-${file.contentType.includes('sheet') || file.contentType.includes('excel') ? 'sheet' : 'pdf'}`}><Icon name={file.contentType.includes('sheet') || file.contentType.includes('excel') ? 'chart' : 'doc'} size={18} /></span>}
      {image && <span className="safety-file-icon is-image"><Icon name="eye" size={18} /></span>}
      <span><b>{image ? 'รูปตรวจอุปกรณ์' : 'ไฟล์หลักฐาน'}</b><em>{meta}</em></span>
      <a href={file.downloadHref} target="_blank" rel="noreferrer" aria-label={image ? 'ดาวน์โหลดรูปหลักฐาน' : 'ดาวน์โหลดไฟล์หลักฐาน'}><Icon name="download" size={15} /></a>
    </div>
    {linkedTask ? <button type="button" className="safety-evidence-task" onClick={() => onOpenTask(linkedTask)}><Icon name="clipboard" size={11} />{file.sourceKind === 'inspection' ? 'เปิดรายการตรวจ' : 'เปิดรายการงาน'}</button> : <span className="safety-evidence-task is-static"><Icon name="clipboard" size={11} />{file.sourceKind === 'inspection' ? 'หลักฐานจากทะเบียนอุปกรณ์' : 'หลักฐานประจำปี'}</span>}
  </article>
}

function SafetyEvidenceLightbox({ file, onClose }: { file: EvidenceItem; onClose: () => void }) {
  const title = file.taskTitle.trim() || 'รูปหลักฐาน'
  return <div className="safety-evidence-lightbox">
    <button type="button" className="safety-evidence-lightbox-backdrop" aria-label="ปิดรูปภาพ" onClick={onClose} />
    <section className="safety-evidence-lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="safety-evidence-lightbox-title">
      <header>
        <div><span className="safety-evidence-lightbox-kicker">{file.sourceKind === 'inspection' ? 'รูปตรวจอุปกรณ์' : 'รูปหลักฐาน'}</span><h2 id="safety-evidence-lightbox-title">{title}</h2><p>{file.periodLabel}{file.referenceCode ? ` · ${file.referenceCode}` : ''}</p></div>
        <button type="button" aria-label="ปิดรูปภาพ" onClick={onClose}><Icon name="x" size={18} /></button>
      </header>
      <div className="safety-evidence-lightbox-image"><img src={file.downloadHref} alt={`รูปหลักฐาน ${title}`} /></div>
      <footer><span>คลิกพื้นที่รอบรูป หรือกด Esc เพื่อปิด</span><a href={file.downloadHref} target="_blank" rel="noreferrer"><Icon name="download" size={14} />ดาวน์โหลด</a></footer>
    </section>
  </div>
}

export function SafetyTaskHub({
  actorId, isEditor, isAdmin, fiscalYear, range, initialOccurrences, templates, initialEvidence, initialCertificates, initialHolidays, people, committeeStaff, initialEditors,
}: {
  actorId: string
  isEditor: boolean
  isAdmin: boolean
  fiscalYear: number
  range: { from: string; to: string }
  initialOccurrences: QualityTaskOccurrence[]
  templates: QualityTaskTemplate[]
  initialEvidence: EvidenceItem[]
  initialCertificates: SafetyCertificate[]
  initialHolidays: QualityTaskHoliday[]
  people: Person[]
  committeeStaff: SafetyCommitteeStaff[]
  initialEditors: SafetyCommitteeEditor[]
}) {
  const [tab, setTab] = useState<Tab>('overview')
  const [occurrences, setOccurrences] = useState(initialOccurrences)
  const [evidence, setEvidence] = useState(initialEvidence)
  const [evidenceSearch, setEvidenceSearch] = useState('')
  const [certificates, setCertificates] = useState(initialCertificates)
  const [holidays] = useState(initialHolidays)
  const [selected, setSelected] = useState<QualityTaskOccurrence | null>(null)
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draggedKey, setDraggedKey] = useState<string | null>(null)
  const [dragOverDay, setDragOverDay] = useState<number | null>(null)
  const draggedRef = useRef<QualityTaskOccurrence | null>(null)
  const [actionItems, setActionItems] = useState<QualityTaskActionItem[]>([])
  const [integrations, setIntegrations] = useState<SafetyIntegration[]>([])
  const [capaText, setCapaText] = useState('')
  const [capaDue, setCapaDue] = useState('')
  const [riskOpen, setRiskOpen] = useState(false)
  const [riskText, setRiskText] = useState('')
  const [riskLikelihood, setRiskLikelihood] = useState(3)
  const [riskImpact, setRiskImpact] = useState(3)
  const [evidenceUploadOpen, setEvidenceUploadOpen] = useState(false)
  const [evidencePreview, setEvidencePreview] = useState<EvidenceItem | null>(null)
  const [collapsedEvidenceGroups, setCollapsedEvidenceGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(groupSafetyEvidence(initialEvidence).flatMap(group => [[group.key, true] as [string, boolean], ...group.children.map(child => [child.key, true] as [string, boolean])])))
  const [certificateOpen, setCertificateOpen] = useState(false)
  const [committeeOpen, setCommitteeOpen] = useState(false)
  const [committeeEditors, setCommitteeEditors] = useState(initialEditors)
  const [replaceCertificateId, setReplaceCertificateId] = useState<string | null>(null)
  const [certDraft, setCertDraft] = useState({ certificateType: '', documentNo: '', holderName: '', department: '', issuedOn: '', expiresOn: '', noExpiry: false, ownerId: '' })
  const closeCommittee = useCallback(() => setCommitteeOpen(false), [])

  useEffect(() => {
    if (window.matchMedia('(max-width: 767px)').matches) setTab('monthly')
  }, [])

  useEffect(() => {
    if (!selected && !certificateOpen && !evidencePreview) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSelected(null); setCertificateOpen(false); setReplaceCertificateId(null); setRiskOpen(false); setEvidencePreview(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [certificateOpen, evidencePreview, selected])

  useEffect(() => {
    if (!evidencePreview) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [evidencePreview])

  useEffect(() => {
    if (!selected?.instanceId || isLinkedQualityOccurrence(selected)) { setActionItems([]); setIntegrations([]); return }
    fetch(`/api/admin/safety-tasks/occurrences/${selected.instanceId}/action-items`)
      .then(response => json<{ items: QualityTaskActionItem[] }>(response))
      .then(body => setActionItems(body.items)).catch(() => setActionItems([]))
    fetch(`/api/admin/safety-tasks/occurrences/${selected.instanceId}/integrations`)
      .then(response => json<{ integrations: SafetyIntegration[] }>(response))
      .then(body => setIntegrations(body.integrations)).catch(() => setIntegrations([]))
  }, [selected])

  const counts = useMemo(() => ({
    all: occurrences.length,
    open: occurrences.filter(item => item.status === 'open').length,
    active: occurrences.filter(item => item.status === 'in_progress').length,
    review: occurrences.filter(item => item.status === 'pending_review').length,
    completed: occurrences.filter(item => item.status === 'completed').length,
    overdue: occurrences.filter(item => item.status !== 'completed' && item.urgency === 'overdue').length,
  }), [occurrences])

  const visibleTasks = useMemo(() => occurrences.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false
    const q = search.trim().toLocaleLowerCase('th')
    return !q || `${item.template.title} ${item.template.referenceCode ?? ''} ${item.template.ownerText}`.toLocaleLowerCase('th').includes(q)
  }), [occurrences, search, statusFilter])

  const calendarItems = useMemo(() => occurrences.filter(item => item.effectiveDueDate.startsWith(calendarMonth)), [calendarMonth, occurrences])
  const deferredEvidenceSearch = useDeferredValue(evidenceSearch)
  const filteredEvidence = useMemo(() => filterSafetyEvidence(evidence, deferredEvidenceSearch), [deferredEvidenceSearch, evidence])
  const evidenceGroups = useMemo(() => groupSafetyEvidence(filteredEvidence), [filteredEvidence])
  const evidenceItemGroupCount = evidenceGroups.reduce((total, group) => total + group.children.length, 0)
  const selectedInspectionEvidence = useMemo(() => summarizeInspectionEvidence(evidence, selected), [evidence, selected])
  const calendarCells = useMemo(() => {
    const [year, month] = calendarMonth.split('-').map(Number)
    const firstDay = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
    const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
    return [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)] as (number | null)[]
  }, [calendarMonth])
  const holidayByDate = useMemo(() => new Map(holidays.map(holiday => [holiday.holidayDate, holiday])), [holidays])

  function blockedDateReason(date: string): string | null {
    if (isWeekendDate(date)) return 'ไม่สามารถเลือกวันเสาร์-อาทิตย์ได้'
    const holiday = holidayByDate.get(date)
    return holiday ? `วันที่เลือกตรงกับวันหยุด: ${holiday.name}` : null
  }

  function openTask(item: QualityTaskOccurrence) {
    setSelected(item)
  }

  async function reload(preferredKey?: string) {
    const [taskBody, evidenceBody, certificateBody] = await Promise.all([
      json<{ occurrences: QualityTaskOccurrence[] }>(await fetch(`/api/admin/safety-tasks/occurrences?from=${range.from}&to=${range.to}`)),
      json<{ evidence: EvidenceItem[] }>(await fetch(`/api/admin/safety-tasks/evidence?fiscalYear=${fiscalYear}`)),
      json<{ certificates: SafetyCertificate[] }>(await fetch('/api/admin/safety-tasks/certificates')),
    ])
    setOccurrences(taskBody.occurrences); setEvidence(evidenceBody.evidence); setCertificates(certificateBody.certificates)
    if (preferredKey) setSelected(taskBody.occurrences.find(item => item.key === preferredKey) ?? null)
  }

  async function ensureInstance(item: QualityTaskOccurrence) {
    if (item.instanceId) return item.instanceId
    if (!item.scheduleId) throw new Error('ไม่พบรอบงานสำหรับสร้างรายการ')
    const body = await json<{ instance: { id: string } }>(await fetch('/api/admin/safety-tasks/occurrences', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'scheduled', scheduleId: item.scheduleId, periodStart: item.periodStart }),
    }))
    return body.instance.id
  }

  async function taskAction(action: 'start' | 'submit' | 'approve' | 'reject') {
    if (!selected) return
    if (action === 'start' && selected.template.integrationKind === 'safety_inspection' && !isMonthlySafetySourceKey(selected.template.sourceKey)) {
      await startInspectionRound()
      return
    }
    setBusy(true); setError('')
    try {
      const id = await ensureInstance(selected)
      let payload: Record<string, unknown> = { action }
      if (action === 'reject') {
        const reason = window.prompt('เหตุผลที่ส่งกลับแก้ไข')?.trim()
        if (!reason) return
        payload = { action, reason }
      }
      await json(await fetch(`/api/admin/safety-tasks/occurrences/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }))
      await reload(selected.key)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  function canRescheduleItem(item: QualityTaskOccurrence) {
    return !isLinkedQualityOccurrence(item) && !isMonthlySafetySourceKey(item.template.sourceKey) && (isEditor || item.assignees.some(entry => entry.userId === actorId))
  }

  async function rescheduleItem(item: QualityTaskOccurrence, date: string) {
    if (busy || (item.plannedDate ?? item.periodStart) === date) return
    const reason = blockedDateReason(date)
    if (reason) { setError(reason); return }
    setBusy(true); setError('')
    try {
      const id = await ensureInstance(item)
      await json(await fetch(`/api/admin/safety-tasks/occurrences/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'schedule', plannedDate: date }) }))
      await reload(selected?.key === item.key ? item.key : undefined)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function startInspectionRound() {
    if (!selected) return
    if (!isEditor) { setError('ต้องให้ Safety Editor เป็นผู้เริ่มรอบตรวจจากหน้านี้'); return }
    setBusy(true); setError('')
    try {
      const id = await ensureInstance(selected)
      const body = await json<{ roundId: string }>(await fetch(`/api/admin/safety-tasks/occurrences/${id}/inspection-round`, { method: 'POST' }))
      window.location.assign(`/staff/lab-map/safety-assets?inspectionRound=${encodeURIComponent(body.roundId)}`)
    } catch (cause) { setError((cause as Error).message); setBusy(false) }
  }

  async function uploadEvidence(item: QualityTaskOccurrence, file: File, requirementId: string | null) {
    setBusy(true); setError('')
    try {
      const instanceId = await ensureInstance(item)
      const presign = await json<{ uploadUrl: string; key: string }>(await fetch('/api/admin/safety-tasks/attachments/presign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      }))
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!upload.ok) throw new Error('อัปโหลดไฟล์ไปคลังหลักฐานไม่สำเร็จ')
      await json(await fetch('/api/admin/safety-tasks/attachments/finalize', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceId, key: presign.key, fileName: file.name, requirementId, evidenceKind: item.template.evidenceRequirements.find(entry => entry.id === requirementId)?.evidenceKind ?? 'document' }),
      }))
      await reload(item.key)
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  function canUploadTo(item: QualityTaskOccurrence) {
    return !isLinkedQualityOccurrence(item) && !isMonthlySafetySourceKey(item.template.sourceKey) && item.status !== 'completed' && item.status !== 'pending_review' && (isEditor || item.assignees.some(entry => entry.userId === actorId))
  }

  async function addCapa() {
    if (!selected || !capaText.trim()) return
    setBusy(true); setError('')
    try {
      const instanceId = await ensureInstance(selected)
      const body = await json<{ item: QualityTaskActionItem }>(await fetch(`/api/admin/safety-tasks/occurrences/${instanceId}/action-items`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee: { userId: actorId, manualName: null }, description: capaText, dueDate: capaDue || null }),
      }))
      setActionItems(items => [...items, body.item]); setCapaText(''); setCapaDue('')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function toggleCapa(item: QualityTaskActionItem) {
    if (!selected?.instanceId) return
    try {
      const body = await json<{ item: QualityTaskActionItem }>(await fetch(`/api/admin/safety-tasks/occurrences/${selected.instanceId}/action-items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: !item.doneAt }),
      }))
      setActionItems(items => items.map(current => current.id === item.id ? body.item : current))
    } catch (cause) { setError((cause as Error).message) }
  }

  async function escalateRisk() {
    if (!selected?.instanceId || !riskText.trim()) return
    setBusy(true); setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      await json(await fetch(`/api/admin/safety-tasks/occurrences/${selected.instanceId}/risk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          risk_no: null, assessed_date: today, department: null, space_code: null, hazard_category: 'ความปลอดภัย',
          process_step: selected.template.title, risk_statement: riskText, affected_parties: null, causes: null,
          existing_controls: null, additional_controls: null, reference_docs: selected.template.referenceCode,
          likelihood: riskLikelihood, impact: riskImpact, owner: selected.template.ownerText, status: 'open', next_review_date: null,
        }),
      }))
      setRiskOpen(false); setRiskText('')
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  async function addCertificate(file: File) {
    setBusy(true); setError('')
    try {
      const presign = await json<{ uploadUrl: string; key: string }>(await fetch('/api/admin/safety-tasks/certificates/presign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: file.name, contentType: file.type, sizeBytes: file.size }),
      }))
      const upload = await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!upload.ok) throw new Error('อัปโหลดใบรับรองไม่สำเร็จ')
      const certificateUrl = replaceCertificateId ? `/api/admin/safety-tasks/certificates/${replaceCertificateId}/replace` : '/api/admin/safety-tasks/certificates'
      await json(await fetch(certificateUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
          certificateType: certDraft.certificateType, documentNo: certDraft.documentNo || null, holderName: certDraft.holderName,
          department: certDraft.department || null, issuedOn: certDraft.issuedOn || null, expiresOn: certDraft.noExpiry ? null : certDraft.expiresOn || null,
          noExpiry: certDraft.noExpiry, ownerId: certDraft.ownerId || null, key: presign.key, fileName: file.name,
        }),
      }))
      setCertificateOpen(false); setReplaceCertificateId(null); setCertDraft({ certificateType: '', documentNo: '', holderName: '', department: '', issuedOn: '', expiresOn: '', noExpiry: false, ownerId: '' })
      await reload()
    } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) }
  }

  return (
    <main className="safety-shell">
      <section className="safety-page-header">
        <PageHeader
          title="งานความปลอดภัยและหลักฐาน"
          subtitle="ติดตามกิจกรรม ข้อกำหนด เอกสารรับรอง และ CAPA ในรอบปีงบประมาณเดียวกัน"
          marginBottom={0}
          actions={<><div className="safety-fiscal"><span>ปีงบประมาณ {fiscalYear}</span><strong>{thaiDate(range.from)} — {thaiDate(range.to)}</strong></div><Link href="/staff/lab-map/safety-assets" className="safety-link-button"><Icon name="shieldCheck" size={16} />ทะเบียนอุปกรณ์</Link><button type="button" className="safety-link-button safety-committee-trigger" onClick={() => setCommitteeOpen(true)} aria-haspopup="dialog"><Icon name="users" size={16} />คณะทำงานความปลอดภัย<span aria-label={`${committeeEditors.length} คน`}>{committeeEditors.length}</span></button>{isEditor && <Link href="/staff/safety/registry" className="safety-link-button"><Icon name="settings" size={16} />จัดการ Master Task</Link>}</>}
        />
      </section>

      <nav className="safety-tabs" role="tablist" aria-label="เมนูงานความปลอดภัย">
        {TABS.map((item, index) => <button id={`safety-tab-${item.id}`} key={item.id} role="tab" aria-selected={tab === item.id} aria-controls={`safety-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)} onKeyDown={event => { if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'Home' && event.key !== 'End') return; event.preventDefault(); const targetIndex = event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length; setTab(TABS[targetIndex].id); requestAnimationFrame(() => document.getElementById(`safety-tab-${TABS[targetIndex].id}`)?.focus()) }}><Icon name={item.icon} size={15} /><span>{item.label}</span>{item.id === 'tasks' && counts.overdue > 0 && <b>{counts.overdue}</b>}</button>)}
      </nav>

      {error && <div className="safety-error" role="alert"><Icon name="alert" size={16} />{error}<button onClick={() => setError('')} aria-label="ปิดข้อความ"><Icon name="x" size={14} /></button></div>}

      {tab === 'monthly' && <section id="safety-panel-monthly" role="tabpanel" aria-labelledby="safety-tab-monthly" className="safety-panel"><MonthlySafetyInspectionBoard isEditor={isEditor} fiscalYear={fiscalYear} /></section>}

      {tab === 'overview' && <section id="safety-panel-overview" role="tabpanel" aria-labelledby="safety-tab-overview" className="safety-panel">
        <div className="safety-metrics">
          {[
            ['งานทั้งหมด', counts.all, 'clipboard', 'neutral'], ['เกินกำหนด', counts.overdue, 'alert', 'danger'],
            ['กำลังทำ', counts.active, 'trending', 'cyan'], ['รอตรวจทาน', counts.review, 'eye', 'amber'], ['เสร็จแล้ว', counts.completed, 'check', 'teal'],
          ].map(([label, value, icon, tone]) => <article key={String(label)} className={`safety-metric is-${tone}`}><Icon name={String(icon)} size={18} /><div><strong>{value}</strong><span>{label}</span></div></article>)}
        </div>
        <div className="safety-overview-grid">
          <section className="safety-card">
            <header><h2>งานที่ต้องจัดการก่อน</h2><button onClick={() => setTab('tasks')}>ดูทั้งหมด <Icon name="arrowRight" size={13} /></button></header>
            <div className="safety-priority-list">
              {occurrences.filter(item => item.status !== 'completed').sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate)).slice(0, 7).map(item => <button key={item.key} onClick={() => openTask(item)}>
                <time>{thaiDate(item.effectiveDueDate, { day: '2-digit', month: 'short' })}</time><span><b>{item.template.title}</b><small>{isLinkedQualityOccurrence(item) ? 'เชื่อมจากปฏิทินงานคุณภาพ' : item.template.referenceCode ?? item.template.frequencyText}</small></span><StatusBadge status={item.status} />
              </button>)}
              {!counts.all && <div className="safety-empty">ยังไม่มีงานในปีงบประมาณนี้</div>}
            </div>
          </section>
          <aside className="safety-card safety-readiness">
            <header><h2>ความพร้อมของหลักฐาน</h2></header>
            <div className="safety-gauge" style={{ '--progress': `${counts.all ? Math.round(counts.completed / counts.all * 100) : 0}%` } as React.CSSProperties}><strong>{counts.all ? Math.round(counts.completed / counts.all * 100) : 0}%</strong><span>ปิดงานแล้ว</span></div>
            <dl><div><dt>ไฟล์หลักฐาน</dt><dd>{evidence.length}</dd></div><div><dt>ใบรับรองใช้งาน</dt><dd>{certificates.length}</dd></div><div><dt>ใกล้หมดอายุ ≤ 60 วัน</dt><dd>{certificates.filter(item => certificateRenewalWindow(item, new Date().toISOString().slice(0, 10)).urgency === 'due-soon').length}</dd></div></dl>
          </aside>
        </div>
      </section>}

      {tab === 'tasks' && <section id="safety-panel-tasks" role="tabpanel" aria-labelledby="safety-tab-tasks" className="safety-panel">
        <div className="safety-toolbar">
          <label className="safety-search"><Icon name="search" size={15} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ค้นหากิจกรรม เอกสารอ้างอิง หรือผู้รับผิดชอบ" /></label>
          <div className="safety-filter" aria-label="กรองสถานะ">{(['all', 'open', 'in_progress', 'pending_review', 'completed'] as const).map(value => <button key={value} aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === 'all' ? 'ทั้งหมด' : STATUS[value].label}</button>)}</div>
        </div>
        <div className="safety-task-list safety-agenda">
          {visibleTasks.map(item => <button key={item.key} className={`safety-task-row is-${item.urgency}`} onClick={() => openTask(item)}>
            <span className="safety-task-date"><b>{new Date(`${item.effectiveDueDate}T00:00:00+07:00`).getDate()}</b><small>{new Date(`${item.effectiveDueDate}T00:00:00+07:00`).toLocaleDateString('th-TH', { month: 'short' })}</small></span>
            <span className="safety-task-main"><span className="safety-task-meta">{item.template.frequencyText}<i>•</i>{isLinkedQualityOccurrence(item) ? 'ข้อมูลหลัก: งานคุณภาพ' : item.template.referenceCode ?? 'ข้อกำหนดภายใน'}</span><strong>{item.template.title}</strong><small>{item.template.ownerText}</small></span>
            <span className="safety-task-evidence"><Icon name={missingEvidenceRequirements(item.template.evidenceRequirements, item.attachments).length ? 'alert' : 'check'} size={14} />{item.attachments.length} ไฟล์</span>
            <StatusBadge status={item.status} />
            <span className={`safety-urgency is-${item.urgency}`}>{urgencyLabel(item)}</span><Icon name="chevRight" size={16} />
          </button>)}
          {!visibleTasks.length && <div className="safety-empty">ไม่พบงานตามตัวกรอง</div>}
        </div>
      </section>}

      {tab === 'calendar' && <section id="safety-panel-calendar" role="tabpanel" aria-labelledby="safety-tab-calendar" className="safety-panel">
        <div className="safety-calendar-head"><button onClick={() => setCalendarMonth(previousMonth(calendarMonth))} aria-label="เดือนก่อน"><Icon name="arrowLeft" /></button><h2>{new Date(`${calendarMonth}-01T00:00:00+07:00`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}</h2><button onClick={() => setCalendarMonth(nextMonth(calendarMonth))} aria-label="เดือนถัดไป"><Icon name="arrowRight" /></button></div>
        <div className="safety-calendar-grid">
          <div className="safety-weekdays">{['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((day, index) => <span key={day} className={index === 0 || index === 6 ? 'safety-weekday is-weekend' : 'safety-weekday'}>{day}</span>)}</div>
          <div className="safety-days">{calendarCells.map((day, index) => {
            const isWeekend = index % 7 === 0 || index % 7 === 6
            const date = day ? `${calendarMonth}-${String(day).padStart(2, '0')}` : null
            const holiday = date ? holidayByDate.get(date) : undefined
            const blocked = isWeekend || Boolean(holiday)
            const acceptsDrop = Boolean(day && draggedKey && !blocked && date)
            return (
              <div
                key={index}
                className={`${isWeekend ? 'safety-day is-weekend' : 'safety-day'}${!day ? ' is-blank' : ''}${holiday ? ' is-holiday' : ''}${dragOverDay === day ? ' is-drag-over' : ''}`}
                onDragOver={acceptsDrop ? (event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; if (dragOverDay !== day) setDragOverDay(day) } : undefined}
                onDragLeave={day && draggedKey ? () => setDragOverDay(current => current === day ? null : current) : undefined}
                onDrop={acceptsDrop ? (event) => {
                  event.preventDefault()
                  const dragged = draggedRef.current
                  draggedRef.current = null; setDraggedKey(null); setDragOverDay(null)
                  if (dragged && date) void rescheduleItem(dragged, date)
                } : undefined}
              >
                {day && <>
                  <b>{day}</b>
                  {holiday && <span className="safety-day-holiday" title={holiday.name}><Icon name="alert" size={10} />{holiday.name}</span>}
                  {calendarItems.filter(item => Number(item.effectiveDueDate.slice(8)) === day).slice(0, 3).map(item => {
                    const draggable = canRescheduleItem(item)
                    return (
                      <button
                        key={item.key}
                        draggable={draggable}
                        onDragStart={draggable ? (event) => { draggedRef.current = item; setDraggedKey(item.key); event.dataTransfer.effectAllowed = 'move' } : undefined}
                        onDragEnd={draggable ? () => { draggedRef.current = null; setDraggedKey(null); setDragOverDay(null) } : undefined}
                        className={`is-${STATUS[item.status].tone}${draggable ? ' is-draggable' : ''}${draggedKey === item.key ? ' is-dragging' : ''}`}
                        onClick={() => openTask(item)}
                      ><Icon name={STATUS[item.status].icon} size={13} />{item.template.title}</button>
                    )
                  })}
                </>}
              </div>
            )
          })}</div>
        </div>
        <div className="safety-calendar-agenda safety-agenda">{calendarItems.sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate)).map(item => <button key={item.key} onClick={() => openTask(item)}><time>{thaiDate(item.effectiveDueDate)}</time><span><b>{item.template.title}</b><small>{holidayByDate.get(item.effectiveDueDate)?.name ?? (isLinkedQualityOccurrence(item) ? 'เชื่อมจากปฏิทินงานคุณภาพ' : item.template.ownerText)}</small></span><StatusBadge status={item.status} /></button>)}</div>
      </section>}

      {tab === 'evidence' && <section id="safety-panel-evidence" role="tabpanel" aria-labelledby="safety-tab-evidence" className="safety-panel">
        <div className="safety-section-head"><div><h2>หลักฐานประจำปีงบประมาณ {fiscalYear}</h2><p>จัดเก็บระหว่าง 1 ต.ค. – 30 ก.ย. รับไฟล์จาก Safety Task และรูปตรวจอุปกรณ์โดยอัตโนมัติ</p></div><div className="safety-section-actions"><span className="safety-count-chip">{evidenceSearch.trim() ? `${filteredEvidence.length}/${evidence.length} ไฟล์ · ${evidenceGroups.length} ประเภท · ${evidenceItemGroupCount} รายการ` : `${evidence.length} ไฟล์ · ${evidenceGroups.length} ประเภท · ${evidenceItemGroupCount} รายการ`}</span>{evidenceGroups.length > 1 && <><button type="button" className="safety-evidence-view-action" onClick={() => setCollapsedEvidenceGroups(Object.fromEntries(evidenceGroupKeys(evidenceGroups).map(key => [key, true])))}>หุบทั้งหมด</button><button type="button" className="safety-evidence-view-action" onClick={() => setCollapsedEvidenceGroups(Object.fromEntries(evidenceGroupKeys(evidenceGroups).map(key => [key, false])))}>แสดงทั้งหมด</button></>}<Button icon="plus" size="sm" onClick={() => setEvidenceUploadOpen(true)}>เพิ่มหลักฐาน</Button></div></div>
        <div className="safety-evidence-toolbar"><label className="safety-evidence-search"><Icon name="search" size={15} /><span>ค้นหา</span><input type="search" value={evidenceSearch} onChange={event => setEvidenceSearch(event.target.value)} placeholder="ถังดับเพลิง 1, รหัสอุปกรณ์ หรือรอบตรวจ" aria-label="ค้นหาหลักฐานประจำปี" /></label>{evidenceSearch && <button type="button" className="safety-evidence-clear" onClick={() => setEvidenceSearch('')}>ล้างการค้นหา</button>}</div>
        <div className="safety-evidence-groups">{evidenceGroups.map((group, index) => {
          const collapsed = evidenceSearch.trim() ? false : Boolean(collapsedEvidenceGroups[group.key] ?? true)
          const groupId = `safety-evidence-group-${index}`
          const imageCount = group.files.filter(isImageEvidence).length
          return <section key={group.key} className={`safety-evidence-group${collapsed ? ' is-collapsed' : ''}`}>
            <button type="button" className="safety-evidence-group-toggle" aria-expanded={!collapsed} aria-controls={groupId} aria-label={`${collapsed ? 'แสดง' : 'หุบ'}กลุ่ม ${group.title}`} onClick={() => setCollapsedEvidenceGroups(current => ({ ...current, [group.key]: !current[group.key] }))}>
              <span className="safety-evidence-group-heading"><Icon name={collapsed ? 'chevRight' : 'chevDown'} size={15} /><span><b>{group.title}</b><small>{group.subtitle}</small></span></span>
              <span className="safety-evidence-group-count">{group.children.length} รายการ · {group.files.length} ไฟล์{imageCount ? ` · ${imageCount} รูป` : ''}</span>
            </button>
            {!collapsed && <div id={groupId} className="safety-evidence-group-body"><div className="safety-evidence-subgroups">{group.children.map((child, childIndex) => {
              const childCollapsed = evidenceSearch.trim() ? false : Boolean(collapsedEvidenceGroups[child.key] ?? true)
              const childId = `safety-evidence-subgroup-${index}-${childIndex}`
              const childImageCount = child.files.filter(isImageEvidence).length
              return <section key={child.key} className={`safety-evidence-subgroup${childCollapsed ? ' is-collapsed' : ''}`}>
                <button type="button" className="safety-evidence-subgroup-toggle" aria-expanded={!childCollapsed} aria-controls={childId} aria-label={`${childCollapsed ? 'แสดง' : 'หุบ'}รายการ ${child.title}`} onClick={() => setCollapsedEvidenceGroups(current => ({ ...current, [child.key]: !current[child.key] }))}>
                  <span className="safety-evidence-group-heading"><Icon name={childCollapsed ? 'chevRight' : 'chevDown'} size={14} /><span><b>{child.title}</b><small>{child.referenceCode ?? child.periodLabel}</small></span></span>
                  <span className="safety-evidence-group-count">{child.files.length} ไฟล์{childImageCount ? ` · ${childImageCount} รูป` : ''}</span>
                </button>
                {!childCollapsed && <div id={childId} className="safety-evidence-subgroup-body"><div className="safety-evidence-grid">{child.files.map(file => <EvidenceFileCard key={file.id} file={file} linkedTask={linkedTaskForEvidence(file, occurrences)} onOpenImage={setEvidencePreview} onOpenTask={openTask} />)}</div></div>}
              </section>
            })}</div></div>}
          </section>
        })}</div>
        {!evidence.length && <div className="safety-empty">ยังไม่มีไฟล์หลักฐานในปีงบประมาณนี้</div>}
        {evidence.length > 0 && !filteredEvidence.length && <div className="safety-empty" role="status">ไม่พบหลักฐานที่ตรงกับ “{evidenceSearch}” ลองค้นหาด้วยชื่ออุปกรณ์หรือรหัส เช่น “ถังดับเพลิง 1”</div>}
      </section>}

      {tab === 'certificates' && <section id="safety-panel-certificates" role="tabpanel" aria-labelledby="safety-tab-certificates" className="safety-panel">
        <div className="safety-section-head"><div><h2>ทะเบียนใบรับรอง</h2><p>ระบบสร้าง Renewal Task ก่อนหมดอายุ 90 วัน และเตือนซ้ำที่ 60/30 วัน</p></div>{isEditor && <Button icon="plus" onClick={() => { setReplaceCertificateId(null); setCertificateOpen(true) }}>เพิ่มใบรับรอง</Button>}</div>
        <div className="safety-certificate-list">{certificates.map(item => {
          const window = certificateRenewalWindow(item, new Date().toISOString().slice(0, 10))
          return <article key={item.id} className={`is-${window.urgency}`}><span className="safety-cert-mark"><Icon name="shieldCheck" size={20} /></span><div><small>{item.certificateType}</small><h3>{item.holderName}</h3><p>{item.documentNo || 'ไม่มีเลขที่'}{item.department ? ` · ${item.department}` : ''}</p></div><dl><dt>วันที่ออก</dt><dd>{thaiDate(item.issuedOn)}</dd></dl><dl><dt>วันหมดอายุ</dt><dd>{item.noExpiry ? 'ไม่มีวันหมดอายุ' : thaiDate(item.expiresOn)}</dd></dl><span className={`safety-renewal is-${window.urgency}`}><Icon name={window.urgency === 'overdue' ? 'alert' : window.shouldCreate ? 'clock' : 'check'} size={13} />{item.noExpiry ? 'ถาวร' : window.urgency === 'overdue' ? `หมดอายุ ${Math.abs(window.daysRemaining ?? 0)} วัน` : window.reminderStage ? `เตือน ${window.reminderStage} วัน · เหลือ ${window.daysRemaining}` : 'ปกติ'}</span><span className="safety-cert-actions"><a href={`/api/admin/safety-tasks/certificates/${item.id}/file`} target="_blank" rel="noreferrer" aria-label={`เปิดไฟล์ ${item.fileName}`}><Icon name="eye" size={16} /></a>{isEditor && <button aria-label={`แทนที่ ${item.certificateType}`} onClick={() => { setReplaceCertificateId(item.id); setCertDraft({ certificateType: item.certificateType, documentNo: item.documentNo ?? '', holderName: item.holderName, department: item.department ?? '', issuedOn: item.issuedOn ?? '', expiresOn: item.expiresOn ?? '', noExpiry: item.noExpiry, ownerId: item.ownerId ?? '' }); setCertificateOpen(true) }}><Icon name="upload" size={15} /></button>}</span></article>
        })}</div>
        {!certificates.length && <div className="safety-empty">ยังไม่มีใบรับรองในทะเบียน</div>}
      </section>}

      {selected && <TaskDrawer item={selected} actorId={actorId} isEditor={isEditor} busy={busy} error={error} actionItems={actionItems} integrations={integrations} inspectionEvidence={selectedInspectionEvidence} capaText={capaText} capaDue={capaDue} riskOpen={riskOpen} riskText={riskText} riskLikelihood={riskLikelihood} riskImpact={riskImpact} onClose={() => { setSelected(null); setError(''); setRiskOpen(false) }} onAction={taskAction} onUpload={(file, requirementId) => uploadEvidence(selected, file, requirementId)} onCapaText={setCapaText} onCapaDue={setCapaDue} onAddCapa={addCapa} onToggleCapa={toggleCapa} onRiskOpen={setRiskOpen} onRiskText={setRiskText} onRiskLikelihood={setRiskLikelihood} onRiskImpact={setRiskImpact} onEscalateRisk={escalateRisk} onReschedule={rescheduleItem} blockedDateReason={blockedDateReason} />}
      {certificateOpen && <CertificateDialog draft={certDraft} people={people} busy={busy} replacing={Boolean(replaceCertificateId)} onChange={setCertDraft} onClose={() => { setCertificateOpen(false); setReplaceCertificateId(null) }} onSubmit={addCertificate} />}
      {evidenceUploadOpen && <EvidenceUploadDialog occurrences={occurrences.filter(canUploadTo)} busy={busy} onClose={() => setEvidenceUploadOpen(false)} onSubmit={async (item, file, requirementId) => { await uploadEvidence(item, file, requirementId); setEvidenceUploadOpen(false) }} />}
      {evidencePreview && <SafetyEvidenceLightbox file={evidencePreview} onClose={() => setEvidencePreview(null)} />}
      {committeeOpen && <SafetyCommitteeManager canManage={isAdmin} staff={committeeStaff} initialEditors={committeeEditors} onClose={closeCommittee} onEditorsChange={(userId, enabled) => setCommitteeEditors(current => enabled ? [...current.filter(item => item.user_id !== userId), { user_id: userId }] : current.filter(item => item.user_id !== userId))} />}

      <style jsx global>{SAFETY_CSS}</style>
    </main>
  )
}

function previousMonth(value: string) { const date = new Date(`${value}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1); return date.toISOString().slice(0, 7) }
function nextMonth(value: string) { const date = new Date(`${value}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() + 1); return date.toISOString().slice(0, 7) }

function TaskDrawer({ item, actorId, isEditor, busy, error, actionItems, integrations, inspectionEvidence, capaText, capaDue, riskOpen, riskText, riskLikelihood, riskImpact, onClose, onAction, onUpload, onCapaText, onCapaDue, onAddCapa, onToggleCapa, onRiskOpen, onRiskText, onRiskLikelihood, onRiskImpact, onEscalateRisk, onReschedule, blockedDateReason }: {
  item: QualityTaskOccurrence; actorId: string; isEditor: boolean; busy: boolean; error: string; actionItems: QualityTaskActionItem[]; integrations: SafetyIntegration[]; inspectionEvidence: InspectionEvidenceSummary; capaText: string; capaDue: string; riskOpen: boolean; riskText: string; riskLikelihood: number; riskImpact: number
  onClose: () => void; onAction: (action: 'start' | 'submit' | 'approve' | 'reject') => void; onUpload: (file: File, requirementId: string | null) => void; onCapaText: (value: string) => void; onCapaDue: (value: string) => void; onAddCapa: () => void; onToggleCapa: (item: QualityTaskActionItem) => void; onRiskOpen: (value: boolean) => void; onRiskText: (value: string) => void; onRiskLikelihood: (value: number) => void; onRiskImpact: (value: number) => void; onEscalateRisk: () => void
  onReschedule: (item: QualityTaskOccurrence, date: string) => void; blockedDateReason: (date: string) => string | null
}) {
  const [requirementId, setRequirementId] = useState(item.template.evidenceRequirements[0]?.id ?? '')
  const [dateWarning, setDateWarning] = useState('')
  const missing = missingEvidenceRequirements(item.template.evidenceRequirements, item.attachments)
  const linkedQualityMeeting = isLinkedQualityOccurrence(item)
  const monthlySafetyTask = isMonthlySafetySourceKey(item.template.sourceKey)
  const inspectionTask = item.template.integrationKind === 'safety_inspection' && !monthlySafetyTask
  const assigned = item.assignees.some(entry => entry.userId === actorId)
  const canOperate = !linkedQualityMeeting && !monthlySafetyTask && (isEditor || assigned)
  const canApprove = isEditor || item.template.approverId === actorId
  const checkedInUserIds = new Set(item.checkIns.map(entry => entry.userId).filter(Boolean))
  return <div className="safety-drawer-layer"><button className="safety-drawer-backdrop" aria-label="ปิดรายละเอียด" onClick={onClose} /><aside className="safety-drawer" role="dialog" aria-modal="true" aria-labelledby="safety-task-title">
    <header><div><span className="safety-reference">{item.template.referenceCode ?? 'SAFETY TASK'}</span><h2 id="safety-task-title">{item.template.title}</h2><p>{item.periodLabel} · กำหนด {thaiDate(item.effectiveDueDate)}</p></div><button onClick={onClose} aria-label="ปิด"><Icon name="x" /></button></header>
    <div className="safety-drawer-status"><StatusBadge status={item.status} /><span className={`safety-urgency is-${item.urgency}`}>{urgencyLabel(item)}</span><span><Icon name="user" size={13} />{item.assignees.map(entry => entry.manualName).filter(Boolean).join(', ') || item.template.ownerText}</span></div>
    {canOperate && item.status !== 'completed' && <div className="safety-date-row">
      <label htmlFor="safety-planned-date"><Icon name="clock" size={13} />เปลี่ยนวันที่</label>
      <input
        id="safety-planned-date"
        type="date"
        defaultValue={item.plannedDate ?? item.effectiveDueDate}
        disabled={busy}
        onChange={(event) => {
          const date = event.target.value
          if (!date) return
          const reason = blockedDateReason(date)
          if (reason) { setDateWarning(reason); event.target.value = item.plannedDate ?? item.effectiveDueDate; return }
          setDateWarning('')
          onReschedule(item, date)
        }}
      />
      {dateWarning && <small className="safety-date-warning"><Icon name="alert" size={11} />{dateWarning}</small>}
    </div>}
    {error && <div className="safety-error" role="alert">{error}</div>}
    <div className="safety-drawer-body">
      {linkedQualityMeeting && <div className="safety-linked-source"><Icon name="calendar" size={18} /><span><b>การประชุมนี้ใช้ข้อมูลหลักจากงานคุณภาพ</b><small>วันประชุม สถานะ ผู้เข้าร่วม และหลักฐานเป็นข้อมูลชุดเดียวกัน</small></span><Link href={linkedQualityTaskHref(item)}>ไปจัดการในงานคุณภาพ <Icon name="arrowRight" size={14} /></Link></div>}
      <section><h3>ข้อกำหนดอ้างอิง</h3><dl className="safety-detail-grid"><div><dt>เอกสาร/แบบฟอร์ม</dt><dd>{item.template.referenceCode ?? 'ข้อกำหนดภายใน'}</dd></div><div><dt>รอบงาน</dt><dd>{item.template.frequencyText}</dd></div><div><dt>การอนุมัติ</dt><dd>{item.template.approvalMode === 'required' ? 'ต้องอนุมัติ' : 'ปิดงานได้เมื่อหลักฐานครบ'}</dd></div><div><dt>แหล่งข้อมูล</dt><dd>{monthlySafetyTask ? 'แท็บตรวจประจำเดือน' : linkedQualityMeeting ? 'ปฏิทินงานคุณภาพ' : item.template.integrationKind === 'safety_inspection' ? 'Inspection Round บนแผนที่' : item.template.integrationKind === 'equipment_reference' ? 'ทะเบียนเครื่องมือ' : 'งานความปลอดภัย'}</dd></div></dl>{item.template.description && <p className="safety-description">{item.template.description}</p>}{monthlySafetyTask && <p className="safety-description">งานแม่รายการนี้ติดตามและปิดอัตโนมัติเมื่อทุกจุดส่งผลหรือถูกข้าม โปรดดำเนินการในแท็บ “ตรวจประจำเดือน”</p>}{item.template.integrationKind === 'equipment_reference' && <Link className="safety-inline-link" href="/staff/equipment"><Icon name="microscope" size={14} />เปิดทะเบียนเครื่องมือ</Link>}{integrations.filter(integration => integration.kind === 'safety_inspection').map(integration => <InspectionResultBlock key={integration.id} integration={integration} />)}</section>
      <section><h3>หลักฐานที่ต้องมี</h3><div className="safety-requirements">{inspectionTask && <div className={inspectionEvidence.assetCount ? 'is-complete' : ''}><Icon name={inspectionEvidence.assetCount ? 'check' : 'clock'} size={14} /><span><b>รูปตรวจอุปกรณ์จาก Inspection Round</b><small>{inspectionEvidence.assetCount ? `มีแล้ว ${inspectionEvidence.assetCount} จุด · ${inspectionEvidence.photoCount} รูป จากทะเบียนอุปกรณ์` : 'ยังไม่มีรูปตรวจอุปกรณ์ในรอบนี้'}</small></span><strong>{inspectionEvidence.assetCount} จุด</strong></div>}{!inspectionTask && item.template.evidenceRequirements.map(requirement => { const count = item.attachments.filter(file => file.requirementId === requirement.id).length; const complete = count >= requirement.minimumFiles; return <div key={requirement.id} className={complete ? 'is-complete' : ''}><Icon name={complete ? 'check' : 'clock'} size={14} /><span><b>{requirement.label}</b><small>{requirement.required ? `บังคับอย่างน้อย ${requirement.minimumFiles} ไฟล์` : 'ไม่บังคับ'}</small></span><strong>{count}/{requirement.minimumFiles}</strong></div>})}{!inspectionTask && !item.template.evidenceRequirements.length && <div className={item.attachments.length ? 'is-complete' : ''}><Icon name={item.attachments.length ? 'check' : 'clock'} size={14} /><span><b>เอกสารหรือรูปภาพประกอบ</b><small>{item.template.evidenceRequired ? 'ต้องมีอย่างน้อย 1 ไฟล์' : 'ไม่บังคับ'}</small></span><strong>{item.attachments.length}</strong></div>}</div>
        <div className="safety-files">{item.attachments.map(file => <a key={file.id} href={`/api/admin/${linkedQualityMeeting ? 'quality-tasks' : 'safety-tasks'}/attachments/${file.id}`} target="_blank" rel="noreferrer"><Icon name="doc" size={14} /><span>{file.fileName}</span><small>{(file.sizeBytes / 1024 / 1024).toFixed(1)} MB</small></a>)}</div>
        {canOperate && item.status !== 'completed' && item.status !== 'pending_review' && <div className="safety-upload-row">{item.template.evidenceRequirements.length > 0 && <select value={requirementId} onChange={event => setRequirementId(event.target.value)} aria-label="ประเภทหลักฐาน">{item.template.evidenceRequirements.map(requirement => <option key={requirement.id} value={requirement.id}>{requirement.label}</option>)}</select>}<label className={busy ? 'is-disabled' : ''}><Icon name="upload" size={14} />แนบไฟล์<input type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" disabled={busy} onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file, requirementId || null); event.currentTarget.value = '' }} /></label></div>}
      </section>
      {linkedQualityMeeting ? <section><h3>ผู้เข้าร่วมและการเช็คอิน</h3><div className="safety-meeting-summary"><span>ผู้เข้าร่วม <b>{item.participants.length}</b> คน</span><span>เช็คอินแล้ว <b>{item.checkIns.length}</b> คน</span></div><div className="safety-meeting-participants">{item.participants.map(person => <div key={person.id}><Icon name={checkedInUserIds.has(person.id) ? 'check' : 'user'} size={14} /><span><b>{person.name}</b><small>{person.positionTitle ?? 'ไม่ระบุตำแหน่ง'}</small></span><em>{checkedInUserIds.has(person.id) ? 'เช็คอินแล้ว' : 'ยังไม่เช็คอิน'}</em></div>)}{!item.participants.length && <p>ยังไม่ได้กำหนดรายชื่อผู้เข้าร่วม</p>}</div></section> : <section><h3>CAPA / Action Item</h3><div className="safety-capa-list">{actionItems.map(action => <label key={action.id} className={action.doneAt ? 'is-done' : ''}><input type="checkbox" checked={Boolean(action.doneAt)} onChange={() => onToggleCapa(action)} /><span><b>{action.description}</b><small>{action.dueDate ? `กำหนด ${thaiDate(action.dueDate)}` : 'ไม่ระบุกำหนด'}</small></span></label>)}</div>{canOperate && <div className="safety-capa-add"><input value={capaText} onChange={event => onCapaText(event.target.value)} placeholder="ระบุการแก้ไข/ป้องกัน" /><input type="date" value={capaDue} onChange={event => onCapaDue(event.target.value)} /><Button size="sm" icon="plus" onClick={onAddCapa} disabled={busy || !capaText.trim()}>เพิ่ม</Button></div>}<button className="safety-risk-toggle" onClick={() => onRiskOpen(!riskOpen)}><Icon name="shield" size={14} />ส่งรายการรุนแรงหรือเกิดซ้ำไป Risk Register</button>{riskOpen && <div className="safety-risk-form"><textarea value={riskText} onChange={event => onRiskText(event.target.value)} placeholder="ถ้า… จะทำให้…" /><label>โอกาสเกิด <select value={riskLikelihood} onChange={event => onRiskLikelihood(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label><label>ผลกระทบ <select value={riskImpact} onChange={event => onRiskImpact(Number(event.target.value))}>{[1,2,3,4,5].map(value => <option key={value}>{value}</option>)}</select></label><Button size="sm" onClick={onEscalateRisk} disabled={busy || !riskText.trim()}>สร้าง Risk</Button></div>}</section>}
      <section><h3>ประวัติการดำเนินงาน</h3><ol className="safety-timeline"><li className="is-done"><i /><span><b>สร้างรอบงาน</b><small>{thaiDate(item.periodStart)}</small></span></li>{item.submittedAt && <li className="is-done"><i /><span><b>ส่งตรวจ / ส่งหลักฐาน</b><small>{new Date(item.submittedAt).toLocaleString('th-TH')}</small></span></li>}{item.reviewedAt && <li className="is-done"><i /><span><b>{item.status === 'in_progress' ? 'ส่งกลับแก้ไข' : 'ตรวจทานแล้ว'}</b><small>{item.reviewNote || new Date(item.reviewedAt).toLocaleString('th-TH')}</small></span></li>}{item.completedAt && <li className="is-done"><i /><span><b>ปิดงาน</b><small>{new Date(item.completedAt).toLocaleString('th-TH')}</small></span></li>}</ol></section>
    </div>
    {canOperate && item.status !== 'completed' && <footer>{inspectionTask ? <>{item.status === 'open' && (isEditor ? <Button variant="secondary" icon="clipboard" onClick={() => onAction('start')} disabled={busy}>เริ่มตรวจอุปกรณ์</Button> : <span className="safety-description">รอ Safety Editor เริ่มรอบตรวจจากหน้านี้</span>)}{item.status === 'pending_review' && canApprove && <><Button variant="secondary" onClick={() => onAction('reject')} disabled={busy}>ส่งกลับแก้ไข</Button><Button icon="check" onClick={() => onAction('approve')} disabled={busy}>อนุมัติและปิดงาน</Button></>}</> : <>{item.status === 'open' && <Button variant="secondary" onClick={() => onAction('start')} disabled={busy}>เริ่มดำเนินการ</Button>}{item.status !== 'pending_review' && <Button icon="check" onClick={() => onAction('submit')} disabled={busy || missing.length > 0}>{item.template.approvalMode === 'required' ? 'ส่งตรวจทาน' : 'ปิดงาน'}</Button>}{item.status === 'pending_review' && canApprove && <><Button variant="secondary" onClick={() => onAction('reject')} disabled={busy}>ส่งกลับแก้ไข</Button><Button icon="check" onClick={() => onAction('approve')} disabled={busy}>อนุมัติและปิดงาน</Button></>}</>}</footer>}
  </aside></div>
}

type CertificateDraft = { certificateType: string; documentNo: string; holderName: string; department: string; issuedOn: string; expiresOn: string; noExpiry: boolean; ownerId: string }
function InspectionResultBlock({ integration }: { integration: SafetyIntegration }) {
  const items = integration.items ?? []
  const completed = items.filter(item => item.status === 'completed').length
  const roundComplete = items.length > 0 && completed === items.length
  const pendingComplete = integration.syncStatus !== 'synced' && roundComplete
  const closedKinds = new Set((integration.metadata.closedKinds as string[] | undefined) ?? [])
  const categorySummary = [...new Set(items.map(item => item.asset?.kind).filter((kind): kind is string => Boolean(kind)))].map(kind => {
    const categoryItems = items.filter(item => item.asset?.kind === kind)
    const categoryCompleted = categoryItems.filter(item => item.status === 'completed').length
    return `${safetyAssetKindLabel(kind) ?? kind} ${categoryCompleted}/${categoryItems.length}${closedKinds.has(kind) ? ' · ปิดแล้ว' : ''}`
  }).join(' · ')
  const abnormal = items.filter(item => item.inspection && item.inspection.result !== 'passed')
  // รอบประจำเดือนใช้แบบฟอร์ม Spill kit / NSS ไม่ใช่การตรวจแบบถ่ายรูปในหน้าอุปกรณ์
  // ส่งผู้ใช้ไปหน้าอุปกรณ์แล้วบันทึกที่นั่น จะปิดจุดตรวจค้างจนส่งผลประจำเดือนไม่ได้
  const monthlyRound = (integration.metadata as { source?: string } | null)?.source === 'monthly_safety'
  const inspectionHref = integration.syncStatus === 'synced'
    ? '/staff/lab-map/safety-assets'
    : `/staff/lab-map/safety-assets?inspectionRound=${encodeURIComponent(integration.sourceId)}`
  return <div className="safety-inspection-result"><header><span><Icon name="clipboard" size={14} />ผล Inspection Round</span><b>{integration.syncStatus === 'synced' ? 'SYNCED' : 'PENDING'}</b></header><div className="safety-inspection-summary"><span>ตรวจแล้ว <b>{completed}/{items.length}</b></span><span>ผิดปกติ <b>{abnormal.length}</b></span>{categorySummary ? <span>ประเภทอุปกรณ์ <b>{categorySummary}</b></span> : null}{monthlyRound ? <em>บันทึกผลในแท็บ “ตรวจประจำเดือน”</em> : <Link className={`safety-inspection-action${pendingComplete ? ' is-primary' : ''}`} href={inspectionHref}>{integration.syncStatus === 'synced' ? 'เปิดทะเบียนอุปกรณ์' : pendingComplete ? 'ปิดรอบและส่งงาน' : 'เปิดอุปกรณ์และรอบตรวจ'}<Icon name="arrowRight" size={13} /></Link>}</div>{items.filter(item => item.inspection).map(item => <div className={`safety-inspection-item is-${item.inspection?.result}`} key={item.inspectionId}><span><b>{item.asset?.name_th ?? item.asset?.code ?? 'อุปกรณ์'}</b><small>{item.inspection?.note || item.inspection?.result}</small></span>{item.inspectionId && <a href={`/api/admin/lab-map/safety-inspections/${item.inspectionId}/photo`} target="_blank" rel="noreferrer"><Icon name="eye" size={13} />รูปตรวจ</a>}</div>)}</div>
}

function CertificateDialog({ draft, people, busy, replacing, onChange, onClose, onSubmit }: { draft: CertificateDraft; people: Person[]; busy: boolean; replacing: boolean; onChange: (value: CertificateDraft) => void; onClose: () => void; onSubmit: (file: File) => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const set = (key: keyof typeof draft, value: string | boolean) => onChange({ ...draft, [key]: value })
  return <div className="safety-dialog-layer"><button className="safety-drawer-backdrop" aria-label="ปิด" onClick={onClose} /><form className="safety-dialog" onSubmit={event => { event.preventDefault(); if (file) onSubmit(file) }}><header><h2>{replacing ? 'แทนที่ใบรับรอง' : 'เพิ่มใบรับรอง'}</h2><button type="button" onClick={onClose} aria-label="ปิด"><Icon name="x" /></button></header><div className="safety-form-grid"><label><span>ประเภทใบรับรอง *</span><input required value={draft.certificateType} onChange={event => set('certificateType', event.target.value)} /></label><label><span>เลขที่</span><input value={draft.documentNo} onChange={event => set('documentNo', event.target.value)} /></label><label><span>ผู้ถือ/หน่วยงาน *</span><input required value={draft.holderName} onChange={event => set('holderName', event.target.value)} /></label><label><span>แผนก</span><input value={draft.department} onChange={event => set('department', event.target.value)} /></label><label><span>วันที่ออก</span><input type="date" value={draft.issuedOn} onChange={event => set('issuedOn', event.target.value)} /></label><label><span>วันหมดอายุ</span><input type="date" disabled={draft.noExpiry} required={!draft.noExpiry} value={draft.expiresOn} onChange={event => set('expiresOn', event.target.value)} /></label><label className="safety-check"><input type="checkbox" checked={draft.noExpiry} onChange={event => set('noExpiry', event.target.checked)} />ไม่มีวันหมดอายุ</label><label><span>ผู้รับผิดชอบ</span><select value={draft.ownerId} onChange={event => set('ownerId', event.target.value)}><option value="">— ไม่ระบุ —</option>{people.map(person => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><div className="safety-file-pick"><span>ไฟล์ใบรับรอง *</span><div className={`safety-dropzone${dragOver ? ' is-drag-over' : ''}${file ? ' has-file' : ''}`} onDragEnter={event => { event.preventDefault(); setDragOver(true) }} onDragOver={event => { event.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={event => { event.preventDefault(); setDragOver(false); const dropped = event.dataTransfer.files?.[0]; if (dropped) setFile(dropped) }}><input className="safety-dropzone-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" aria-label="เลือกไฟล์ใบรับรอง" aria-required="true" disabled={busy} onChange={event => { setFile(event.target.files?.[0] ?? null); event.currentTarget.value = '' }} />{file ? <span className="safety-dropzone-file"><Icon name="doc" size={16} /><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setFile(null) }} aria-label="เอาไฟล์ออก"><Icon name="x" size={13} /></button></span> : <span className="safety-dropzone-empty"><Icon name="upload" size={18} /><b>{dragOver ? 'วางไฟล์ที่นี่' : 'ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์'}</b><small>{replacing ? 'ฉบับเดิมและประวัติจะยังคงอยู่' : 'PDF, JPG, PNG, XLS, XLSX ไม่เกิน 20 MB'}</small></span>}</div></div></div><footer><Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button><Button type="submit" icon="upload" disabled={busy || !file}>{replacing ? 'บันทึกฉบับใหม่' : 'บันทึกใบรับรอง'}</Button></footer></form></div>
}

function EvidenceUploadDialog({ occurrences, busy, onClose, onSubmit }: { occurrences: QualityTaskOccurrence[]; busy: boolean; onClose: () => void; onSubmit: (item: QualityTaskOccurrence, file: File, requirementId: string | null) => void }) {
  const [search, setSearch] = useState('')
  const [taskKey, setTaskKey] = useState('')
  const [requirementId, setRequirementId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const filtered = useMemo(() => occurrences.filter(item => {
    const q = search.trim().toLocaleLowerCase('th')
    return !q || `${item.template.title} ${item.template.referenceCode ?? ''}`.toLocaleLowerCase('th').includes(q)
  }).sort((a, b) => a.effectiveDueDate.localeCompare(b.effectiveDueDate)), [occurrences, search])
  const task = occurrences.find(item => item.key === taskKey) ?? null
  const requirements = task?.template.evidenceRequirements ?? []
  useEffect(() => { setRequirementId(requirements[0]?.id ?? '') }, [taskKey])
  return <div className="safety-dialog-layer"><button className="safety-drawer-backdrop" aria-label="ปิด" onClick={onClose} /><form className="safety-dialog" onSubmit={event => { event.preventDefault(); if (task && file) onSubmit(task, file, requirementId || null) }}>
    <header><h2>เพิ่มหลักฐาน</h2><button type="button" onClick={onClose} aria-label="ปิด"><Icon name="x" /></button></header>
    <div className="safety-form-grid">
      <label className="safety-file-pick"><span>ค้นหางาน</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="ชื่อกิจกรรมหรือเอกสารอ้างอิง" /></label>
      <label className="safety-file-pick"><span>งานที่หลักฐานนี้เป็นของ *</span><select required value={taskKey} onChange={event => setTaskKey(event.target.value)}>
        <option value="">— เลือกงาน —</option>
        {filtered.map(item => <option key={item.key} value={item.key}>{item.template.title} · กำหนด {thaiDate(item.effectiveDueDate)}</option>)}
      </select>{!filtered.length && <small>ไม่พบงานที่คุณสามารถแนบไฟล์ได้ในขณะนี้</small>}</label>
      {task && <div className="safety-file-pick safety-evidence-task-context"><Icon name="clipboard" size={14} /><span><b>{task.template.title}</b><small>{task.template.referenceCode ?? 'ข้อกำหนดภายใน'} · {task.periodLabel}</small></span></div>}
      {task && requirements.length > 0 && <label className="safety-file-pick"><span>ประเภทหลักฐาน</span><select value={requirementId} onChange={event => setRequirementId(event.target.value)}>{requirements.map(requirement => <option key={requirement.id} value={requirement.id}>{requirement.label}</option>)}</select></label>}
      <div className="safety-file-pick">
        <span>ไฟล์หลักฐาน *</span>
        <div
          className={`safety-dropzone${dragOver ? ' is-drag-over' : ''}${file ? ' has-file' : ''}`}
          onDragOver={event => { event.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={event => {
            event.preventDefault(); setDragOver(false)
            const dropped = event.dataTransfer.files?.[0]
            if (dropped) setFile(dropped)
          }}
        >
          <input className="safety-dropzone-input" type="file" accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx" aria-label="เลือกไฟล์หลักฐาน" onChange={event => setFile(event.target.files?.[0] ?? null)} />
          {file
            ? <span className="safety-dropzone-file"><Icon name="doc" size={16} /><b>{file.name}</b><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><button type="button" onClick={event => { event.preventDefault(); event.stopPropagation(); setFile(null) }} aria-label="เอาไฟล์ออก"><Icon name="x" size={13} /></button></span>
            : <span className="safety-dropzone-empty"><Icon name="upload" size={18} /><b>ลากไฟล์มาวาง หรือคลิกเพื่อเลือกไฟล์</b><small>PDF, JPG, PNG, XLS, XLSX ไม่เกิน 20 MB</small></span>}
        </div>
      </div>
    </div>
    <footer><Button type="button" variant="secondary" onClick={onClose}>ยกเลิก</Button><Button type="submit" icon="upload" disabled={busy || !task || !file}>บันทึกหลักฐาน</Button></footer>
  </form></div>
}

const SAFETY_CSS = `
.safety-inspection-result{margin-top:12px;border:1px solid color-mix(in srgb,var(--safety) 28%,var(--border));border-radius:8px;overflow:hidden}.safety-inspection-result>header{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:color-mix(in srgb,var(--safety) 7%,var(--card))}.safety-inspection-result>header span{display:flex;align-items:center;gap:5px;font-size:10px;font-weight:750}.safety-inspection-result>header b{color:var(--safety);font-size:8px;letter-spacing:.1em}.safety-inspection-summary{display:flex;align-items:center;gap:14px;padding:7px 10px;border-top:1px solid var(--border);border-bottom:1px solid var(--border);font-size:9px;color:var(--muted)}.safety-inspection-summary b{color:var(--ink)}.safety-inspection-summary a{margin-left:auto;color:var(--safety);font-weight:700;text-decoration:none}.safety-inspection-summary .safety-inspection-action{display:inline-flex;align-items:center;justify-content:center;gap:5px;min-height:36px;padding:0 11px;border:1px solid color-mix(in srgb,var(--safety) 34%,var(--border));border-radius:8px;background:var(--card);color:var(--safety);font-weight:800;white-space:nowrap;transition:background-color .18s ease,border-color .18s ease,box-shadow .18s ease}.safety-inspection-summary .safety-inspection-action:hover{border-color:var(--safety);background:var(--safety-pale);box-shadow:0 3px 10px color-mix(in srgb,var(--safety) 16%,transparent)}.safety-inspection-summary .safety-inspection-action.is-primary{border-color:var(--safety);background:var(--safety);color:#fff}.safety-inspection-summary .safety-inspection-action.is-primary:hover{border-color:color-mix(in srgb,var(--safety) 82%,#000);background:color-mix(in srgb,var(--safety) 88%,#000)}.safety-inspection-summary em{margin-left:auto;font-style:normal;font-weight:700;color:var(--safety)}.safety-inspection-item{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;border-bottom:1px dashed var(--border)}.safety-inspection-item:last-child{border-bottom:0}.safety-inspection-item>span{display:flex;flex-direction:column}.safety-inspection-item b{font-size:9px}.safety-inspection-item small{font-size:8px;color:var(--muted)}.safety-inspection-item>a{display:flex;align-items:center;gap:4px;color:var(--safety);font-size:8px;text-decoration:none}.safety-inspection-item.is-failed,.safety-inspection-item.is-needs_attention{background:#fff7ed}
.safety-shell{--safety:var(--primary);--safety-dark:var(--primary);--safety-teal:#047857;--safety-pale:var(--primary-soft);width:100%;padding:0;color:var(--ink);font-size:13px}
.safety-page-header{padding:18px;border-radius:14px;background:linear-gradient(135deg,var(--card),var(--surface-2));box-shadow:0 10px 28px rgba(15,23,42,.06)}
.safety-fiscal{display:flex;flex-direction:column;gap:2px;min-height:40px;padding:7px 11px;border:1px solid var(--border);border-radius:8px;background:var(--card)}.safety-fiscal span{font-size:11px;color:var(--muted)}.safety-fiscal strong{font-size:12px}.safety-link-button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:0 14px;border-radius:8px;background:var(--primary);color:white;text-decoration:none;font-size:13px;font-weight:650;transition:filter .18s ease}.safety-link-button:hover{filter:brightness(.95)}.safety-committee-trigger{border:1px solid var(--primary);font-family:inherit;cursor:pointer}.safety-committee-trigger>span{display:inline-grid;place-items:center;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:color-mix(in srgb,var(--card) 86%,transparent);color:var(--primary);font-size:11px;font-weight:800}
.safety-tabs{display:flex;gap:4px;margin:18px 0;border-bottom:1px solid var(--border);overflow-x:auto}.safety-tabs button{position:relative;display:flex;align-items:center;gap:7px;min-height:42px;padding:10px 15px;border:0;background:transparent;color:var(--muted);font-family:inherit;font-size:13px;white-space:nowrap;cursor:pointer}.safety-tabs button[aria-selected=true]{color:var(--primary);font-weight:700}.safety-tabs button[aria-selected=true]:after{content:"";position:absolute;height:3px;left:10px;right:10px;bottom:-1px;background:var(--primary)}.safety-tabs b{min-width:20px;padding:2px 6px;border-radius:10px;background:#dc2626;color:white;font-size:11px}
.safety-panel{animation:safety-in .2s ease-out}@keyframes safety-in{from{opacity:.4;transform:translateY(3px)}to{opacity:1;transform:none}}
.safety-error{display:flex;align-items:center;gap:8px;margin:10px 0;padding:10px 12px;border:1px solid #fecaca;border-radius:8px;background:#fef2f2;color:#b91c1c;font-size:12px}.safety-error button{margin-left:auto;border:0;background:none;color:inherit;cursor:pointer}
.safety-metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}.safety-metric{display:flex;align-items:center;gap:12px;padding:15px 16px;border:1px solid var(--border);border-top:3px solid #94a3b8;border-radius:10px;background:var(--card)}.safety-metric>svg{color:#64748b}.safety-metric div{display:flex;flex-direction:column}.safety-metric strong{font-size:24px;line-height:1}.safety-metric span{margin-top:4px;color:var(--muted);font-size:11px}.safety-metric.is-danger{border-top-color:#dc2626}.safety-metric.is-danger>svg{color:#dc2626}.safety-metric.is-cyan{border-top-color:#0891b2}.safety-metric.is-cyan>svg{color:#0891b2}.safety-metric.is-amber{border-top-color:#d97706}.safety-metric.is-amber>svg{color:#d97706}.safety-metric.is-teal{border-top-color:#0f766e}.safety-metric.is-teal>svg{color:#0f766e}
.safety-overview-grid{display:grid;grid-template-columns:minmax(0,1.75fr) minmax(270px,.7fr);gap:14px;margin-top:14px}.safety-card{border:1px solid var(--border);border-radius:12px;background:var(--card)}.safety-card>header{display:flex;justify-content:space-between;align-items:center;padding:16px 18px;border-bottom:1px solid var(--border)}.safety-card header small,.safety-section-head small,.safety-dialog header small{color:var(--safety);font-size:9px;font-weight:800;letter-spacing:.14em}.safety-card h2,.safety-section-head h2{margin:2px 0 0;font-size:17px}.safety-card header button{display:flex;align-items:center;gap:5px;border:0;background:none;color:var(--safety);font-family:inherit;font-size:11px;cursor:pointer}
.safety-priority-list>button{width:100%;display:grid;grid-template-columns:62px minmax(0,1fr) auto;align-items:center;gap:12px;padding:12px 18px;border:0;border-bottom:1px solid var(--border);background:transparent;text-align:left;font-family:inherit;color:inherit;cursor:pointer}.safety-priority-list>button:hover{background:color-mix(in srgb,var(--safety) 5%,transparent)}.safety-priority-list time{font-weight:750;color:var(--safety)}.safety-priority-list span{display:flex;flex-direction:column;min-width:0}.safety-priority-list span b{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.safety-priority-list span small{color:var(--muted);font-size:10px}
.safety-readiness{padding-bottom:14px}.safety-gauge{position:relative;width:150px;height:150px;margin:22px auto 16px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:conic-gradient(var(--safety-teal) var(--progress),var(--border) 0)}.safety-gauge:after{content:"";position:absolute;inset:14px;border-radius:50%;background:var(--card)}.safety-gauge strong,.safety-gauge span{z-index:1}.safety-gauge strong{font-size:27px}.safety-gauge span{font-size:10px;color:var(--muted)}.safety-readiness dl{margin:0 18px}.safety-readiness dl div{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px dashed var(--border);font-size:11px}.safety-readiness dt{color:var(--muted)}.safety-readiness dd{margin:0;font-weight:700}
.safety-toolbar{display:flex;justify-content:space-between;gap:12px;margin-bottom:12px}.safety-search{display:flex;align-items:center;gap:8px;min-width:300px;padding:0 11px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:var(--muted)}.safety-search input{width:100%;height:36px;border:0;outline:0;background:transparent;color:var(--ink);font-family:inherit}.safety-filter{display:flex;gap:4px}.safety-filter button{padding:7px 10px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--muted);font-family:inherit;font-size:11px;cursor:pointer}.safety-filter button[aria-pressed=true]{border-color:var(--safety);background:color-mix(in srgb,var(--safety) 10%,var(--card));color:var(--safety);font-weight:700}
.safety-task-list{border:1px solid var(--border);border-radius:11px;background:var(--card);overflow:hidden}.safety-task-row{position:relative;width:100%;display:grid;grid-template-columns:54px minmax(260px,1fr) 90px 125px 80px 18px;align-items:center;gap:12px;padding:12px 14px;border:0;border-bottom:1px solid var(--border);background:transparent;color:inherit;text-align:left;font-family:inherit;cursor:pointer}.safety-task-row:before{content:"";position:absolute;left:0;width:3px;height:100%;background:#cbd5e1}.safety-task-row.is-overdue:before{background:#dc2626}.safety-task-row.is-due-soon:before{background:#d97706}.safety-task-row:hover{background:color-mix(in srgb,var(--safety) 4%,transparent)}.safety-task-date{display:flex;flex-direction:column;align-items:center}.safety-task-date b{font-size:19px;color:var(--safety)}.safety-task-date small{font-size:9px;color:var(--muted)}.safety-task-main{display:flex;flex-direction:column;min-width:0}.safety-task-main strong{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.safety-task-main small{font-size:10px;color:var(--muted)}.safety-task-meta{display:flex;gap:5px;color:var(--safety);font-size:9px;font-weight:700}.safety-task-meta i{font-style:normal;color:var(--muted)}.safety-task-evidence{display:flex;align-items:center;gap:5px;color:var(--muted);font-size:10px}
.safety-status{display:inline-flex;align-items:center;justify-content:center;gap:5px;width:max-content;padding:4px 7px;border-radius:12px;font-size:9.5px;font-weight:700;background:#f1f5f9;color:#475569}.safety-status.is-cyan{background:#ecfeff;color:#0e7490}.safety-status.is-amber{background:#fffbeb;color:#b45309}.safety-status.is-teal{background:#ecfdf5;color:#047857}.safety-urgency{font-size:9px;font-weight:700;color:#64748b}.safety-urgency.is-overdue{color:#dc2626}.safety-urgency.is-due-soon{color:#b45309}
.safety-empty{padding:42px;text-align:center;color:var(--muted);font-size:12px}
.safety-calendar-head{display:flex;justify-content:center;align-items:center;gap:16px;margin-bottom:12px}.safety-calendar-head h2{min-width:220px;margin:0;text-align:center;font-size:17px}.safety-calendar-head button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:inherit;cursor:pointer}.safety-calendar-grid{border:1px solid var(--border);border-radius:11px;overflow:hidden;background:var(--card)}.safety-weekdays,.safety-days{display:grid;grid-template-columns:repeat(7,1fr)}.safety-weekdays span{padding:8px;text-align:center;background:color-mix(in srgb,var(--safety) 5%,var(--card));color:var(--muted);font-size:10px;font-weight:700}.safety-days>div{min-height:108px;padding:7px;border-top:1px solid var(--border);border-right:1px solid var(--border)}.safety-days>div:nth-child(7n){border-right:0}.safety-days>div>b{display:block;margin-bottom:4px;font-size:10px}.safety-days button{width:100%;display:flex;align-items:center;gap:3px;margin:3px 0;padding:3px 4px;border:0;border-left:2px solid #64748b;background:#f8fafc;color:#334155;font-family:inherit;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.safety-days button.is-teal{border-color:#0f766e}.safety-days button.is-cyan{border-color:#0891b2}.safety-days button.is-amber{border-color:#d97706}.safety-days button.is-draggable{cursor:grab}.safety-days button.is-dragging{opacity:.45;cursor:grabbing}.safety-day.is-holiday:not(.is-blank){background:color-mix(in srgb,var(--danger) 7%,var(--card))}.safety-day.is-drag-over{background:var(--primary-soft);outline:2px dashed var(--primary);outline-offset:-2px}.safety-day-holiday{display:flex;align-items:center;gap:3px;margin-bottom:4px;color:var(--danger);font-size:8px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.safety-date-row{display:flex;flex-direction:column;gap:5px;padding:11px 22px;border-bottom:1px solid var(--border)}.safety-date-row label{display:flex;align-items:center;gap:6px;font-size:11px;font-weight:650;color:var(--muted)}.safety-date-row input{width:max-content;padding:7px 9px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:inherit;font-family:inherit;font-size:12px}.safety-date-warning{display:flex;align-items:center;gap:4px;color:var(--danger);font-size:10px}.safety-calendar-agenda{display:none}
.safety-section-head{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin:5px 0 16px}.safety-section-actions{display:flex;align-items:center;gap:10px}.safety-count-chip{padding:6px 10px;border-radius:12px;background:var(--safety-pale);color:var(--safety);font-size:10px;font-weight:700}.safety-evidence-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.safety-evidence-card{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:9px;background:var(--card);overflow:hidden}.safety-evidence-card:hover{border-color:var(--safety)}.safety-evidence-card>a{display:grid;grid-template-columns:38px minmax(0,1fr) 16px;align-items:center;gap:10px;padding:12px;color:inherit;text-decoration:none}.safety-evidence-card>a>span:nth-child(2){display:flex;flex-direction:column;min-width:0}.safety-evidence-card b{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.safety-evidence-card em{font-size:9px;color:var(--muted);font-style:normal}.safety-evidence-task{display:flex;align-items:center;gap:5px;padding:6px 12px;border:0;border-top:1px dashed var(--border);background:color-mix(in srgb,var(--safety) 4%,transparent);color:var(--safety);font-family:inherit;font-size:9px;font-weight:650;text-align:left;cursor:pointer;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safety-evidence-task.is-static{color:var(--muted);cursor:default}.safety-file-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:8px;background:#fef2f2;color:#dc2626}.safety-file-icon.is-image{background:#ecfeff;color:#0891b2}.safety-file-icon.is-sheet{background:#ecfdf5;color:#059669}
.safety-evidence-view-action{min-height:32px;padding:0 9px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--safety);font-family:inherit;font-size:11px;font-weight:700;cursor:pointer;transition:background-color .18s ease,border-color .18s ease}.safety-evidence-view-action:hover{border-color:var(--safety);background:var(--safety-pale)}.safety-evidence-groups{display:flex;flex-direction:column;gap:12px}.safety-evidence-group{border:1px solid var(--border);border-radius:12px;background:var(--card);overflow:hidden;box-shadow:0 5px 18px rgba(15,23,42,.04)}.safety-evidence-group-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:64px;gap:14px;padding:12px 14px;border:0;background:var(--card);color:inherit;text-align:left;font-family:inherit;cursor:pointer;transition:background-color .18s ease}.safety-evidence-group-toggle:hover{background:color-mix(in srgb,var(--safety) 5%,var(--card))}.safety-evidence-group-heading{display:flex;align-items:center;gap:9px;min-width:0}.safety-evidence-group-heading>svg{flex:0 0 auto;color:var(--safety)}.safety-evidence-group-heading>span{display:flex;flex-direction:column;gap:3px;min-width:0}.safety-evidence-group-heading b{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safety-evidence-group-heading small{color:var(--muted);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.safety-evidence-group-count{flex:0 0 auto;padding:5px 8px;border-radius:999px;background:var(--safety-pale);color:var(--safety);font-size:10px;font-weight:750;white-space:nowrap}.safety-evidence-group-body{padding:10px;background:color-mix(in srgb,var(--surface-2) 55%,var(--card));border-top:1px solid var(--border)}.safety-evidence-card{box-shadow:0 2px 10px rgba(15,23,42,.035)}.safety-evidence-card.is-image{min-width:0}.safety-evidence-preview{position:relative;display:block;width:100%;aspect-ratio:4/3;padding:0;border:0;background:#e2e8f0;cursor:pointer;overflow:hidden}.safety-evidence-preview img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .25s ease,filter .25s ease}.safety-evidence-preview:hover img{transform:scale(1.025);filter:brightness(.84)}.safety-evidence-preview>span{position:absolute;right:9px;bottom:9px;display:inline-flex;align-items:center;gap:5px;padding:6px 8px;border-radius:7px;background:rgba(15,23,42,.78);color:#fff;font-size:10px;font-weight:700;opacity:.95}.safety-evidence-file-row{display:grid;grid-template-columns:36px minmax(0,1fr) 28px;align-items:center;gap:9px;padding:10px 11px}.safety-evidence-file-row>span:nth-child(2){display:flex;flex-direction:column;min-width:0}.safety-evidence-file-row b{font-size:11px}.safety-evidence-file-row em{font-size:9px;color:var(--muted);font-style:normal}.safety-evidence-file-row>a{display:grid;place-items:center;width:28px;height:28px;border:1px solid var(--border);border-radius:7px;color:var(--safety);text-decoration:none;transition:background-color .18s ease,border-color .18s ease}.safety-evidence-file-row>a:hover{border-color:var(--safety);background:var(--safety-pale)}.safety-evidence-lightbox{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:22px}.safety-evidence-lightbox-backdrop{position:absolute;inset:0;width:100%;height:100%;border:0;background:rgba(15,23,42,.72);cursor:pointer}.safety-evidence-lightbox-dialog{position:relative;z-index:1;display:grid;grid-template-rows:auto minmax(0,1fr) auto;width:min(1080px,94vw);max-height:90vh;overflow:hidden;border:1px solid color-mix(in srgb,var(--border) 78%,white);border-radius:16px;background:var(--card);box-shadow:0 28px 80px rgba(15,23,42,.34)}.safety-evidence-lightbox-dialog>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:16px 18px;border-bottom:1px solid var(--border)}.safety-evidence-lightbox-dialog>header>div{min-width:0}.safety-evidence-lightbox-kicker{display:block;margin-bottom:4px;color:var(--safety);font-size:10px;font-weight:800;letter-spacing:.08em}.safety-evidence-lightbox-dialog h2{margin:0;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.safety-evidence-lightbox-dialog p{margin:4px 0 0;color:var(--muted);font-size:11px}.safety-evidence-lightbox-dialog>header>button{display:grid;place-items:center;flex:0 0 auto;width:36px;height:36px;border:1px solid var(--border);border-radius:8px;background:var(--card);color:inherit;cursor:pointer}.safety-evidence-lightbox-dialog>header>button:hover{border-color:var(--safety);color:var(--safety)}.safety-evidence-lightbox-image{min-height:0;padding:16px;background:#0f172a;display:grid;place-items:center}.safety-evidence-lightbox-image img{display:block;max-width:100%;max-height:64vh;width:auto;height:auto;object-fit:contain}.safety-evidence-lightbox-dialog>footer{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 18px;border-top:1px solid var(--border);color:var(--muted);font-size:10px}.safety-evidence-lightbox-dialog>footer a{display:inline-flex;align-items:center;gap:6px;color:var(--safety);font-weight:750;text-decoration:none}.safety-evidence-lightbox-dialog>footer a:hover{text-decoration:underline}
.safety-evidence-task-context{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid color-mix(in srgb,var(--safety) 26%,var(--border));border-radius:8px;background:var(--safety-pale);color:var(--safety)}.safety-evidence-task-context span{display:flex;flex-direction:column;gap:2px;color:var(--ink)}.safety-evidence-task-context b{font-size:11px}.safety-evidence-task-context small{font-size:9px;color:var(--muted)}
.safety-certificate-list{display:flex;flex-direction:column;gap:7px}.safety-certificate-list article{display:grid;grid-template-columns:42px minmax(220px,1fr) 130px 140px 120px 68px;align-items:center;gap:14px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--safety-teal);border-radius:8px;background:var(--card)}.safety-certificate-list article.is-due-soon{border-left-color:#d97706}.safety-certificate-list article.is-overdue{border-left-color:#dc2626}.safety-cert-mark{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:var(--safety-pale);color:var(--safety)}.safety-certificate-list article small{color:var(--safety);font-size:9px;font-weight:700}.safety-certificate-list h3{margin:2px 0;font-size:13px}.safety-certificate-list p{margin:0;color:var(--muted);font-size:10px}.safety-certificate-list dl{margin:0}.safety-certificate-list dt{font-size:9px;color:var(--muted)}.safety-certificate-list dd{margin:2px 0;font-size:11px;font-weight:600}.safety-renewal{display:inline-flex;align-items:center;gap:4px;color:#047857;font-size:9px;font-weight:700}.safety-renewal.is-due-soon{color:#b45309}.safety-renewal.is-overdue{color:#dc2626}.safety-cert-actions{display:flex;gap:4px}.safety-cert-actions a,.safety-cert-actions button{display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--safety);cursor:pointer}
.safety-drawer-layer,.safety-dialog-layer{position:fixed;inset:0;z-index:70}.safety-drawer-backdrop{position:absolute;inset:0;border:0;background:rgba(15,23,42,.42);cursor:default}.safety-drawer{position:absolute;right:0;top:0;bottom:0;width:min(610px,94vw);display:flex;flex-direction:column;background:var(--card);box-shadow:-20px 0 50px rgba(15,23,42,.18);animation:drawer-in .22s ease-out}@keyframes drawer-in{from{transform:translateX(30px);opacity:.5}to{transform:none;opacity:1}}.safety-drawer>header{display:flex;justify-content:space-between;padding:20px 22px 14px;border-bottom:1px solid var(--border)}.safety-drawer>header h2{margin:5px 0 2px;font-size:19px}.safety-drawer>header p{margin:0;color:var(--muted);font-size:11px}.safety-drawer>header button,.safety-dialog header button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:transparent;color:inherit;cursor:pointer}.safety-reference{padding:3px 6px;background:var(--safety);color:white;font-size:8px;font-weight:800;letter-spacing:.1em}.safety-drawer-status{display:flex;align-items:center;gap:10px;padding:9px 22px;border-bottom:1px solid var(--border)}.safety-drawer-status>span:last-child{display:flex;align-items:center;gap:5px;margin-left:auto;color:var(--muted);font-size:10px}.safety-drawer-body{flex:1;overflow-y:auto;padding:0 22px 25px}.safety-drawer-body>section{padding:18px 0;border-bottom:1px solid var(--border)}.safety-drawer-body h3{display:flex;align-items:center;gap:8px;margin:0 0 12px;font-size:12px}.safety-drawer-body h3>span{font-size:9px;color:var(--safety);font-weight:800}.safety-detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0}.safety-detail-grid div{padding:9px;background:color-mix(in srgb,var(--safety) 4%,var(--card));border-radius:6px}.safety-detail-grid dt{color:var(--muted);font-size:9px}.safety-detail-grid dd{margin:2px 0;font-size:11px;font-weight:650}.safety-description{font-size:11px;color:var(--muted);line-height:1.6}.safety-inline-link,.safety-risk-toggle{display:inline-flex;align-items:center;gap:6px;margin-top:8px;color:var(--safety);font-size:10px;text-decoration:none}.safety-risk-toggle{border:0;background:transparent;font-family:inherit;cursor:pointer}
.safety-linked-source{display:grid;grid-template-columns:20px minmax(0,1fr) auto;align-items:center;gap:10px;margin-top:16px;padding:12px;border:1px solid color-mix(in srgb,var(--primary) 26%,var(--border));border-radius:10px;background:var(--primary-soft);color:var(--primary)}.safety-linked-source>span{display:flex;flex-direction:column;gap:2px}.safety-linked-source b{font-size:13px}.safety-linked-source small{color:var(--muted);font-size:11px}.safety-linked-source a{display:inline-flex;align-items:center;gap:5px;min-height:36px;padding:0 10px;border:1px solid color-mix(in srgb,var(--primary) 30%,var(--border));border-radius:8px;background:var(--card);color:var(--primary);font-size:11px;font-weight:700;text-decoration:none}.safety-meeting-summary{display:flex;gap:8px;margin-bottom:8px}.safety-meeting-summary span{padding:7px 9px;border-radius:7px;background:var(--surface-2);color:var(--muted);font-size:11px}.safety-meeting-summary b{color:var(--ink)}.safety-meeting-participants{display:flex;flex-direction:column}.safety-meeting-participants>div{display:grid;grid-template-columns:18px minmax(0,1fr) auto;align-items:center;gap:8px;padding:8px;border-bottom:1px dashed var(--border)}.safety-meeting-participants>div>span{display:flex;flex-direction:column}.safety-meeting-participants b{font-size:12px}.safety-meeting-participants small{color:var(--muted);font-size:10px}.safety-meeting-participants em{color:var(--muted);font-size:10px;font-style:normal}.safety-meeting-participants p{margin:0;color:var(--muted);font-size:12px}
.safety-requirements{display:flex;flex-direction:column;gap:5px}.safety-requirements>div{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:7px;padding:8px;border:1px solid #fed7aa;border-radius:6px;background:#fff7ed;color:#c2410c}.safety-requirements>div.is-complete{border-color:#a7f3d0;background:#ecfdf5;color:#047857}.safety-requirements span{display:flex;flex-direction:column}.safety-requirements b{font-size:10px}.safety-requirements small{font-size:8px;opacity:.8}.safety-requirements strong{font-size:10px}.safety-files{display:flex;flex-direction:column;margin-top:7px}.safety-files a{display:flex;align-items:center;gap:6px;padding:6px;color:var(--ink);text-decoration:none;font-size:10px}.safety-files a span{flex:1}.safety-files a small{color:var(--muted)}.safety-upload-row{display:flex;gap:7px;margin-top:8px}.safety-upload-row select{flex:1;min-width:0;border:1px solid var(--border);border-radius:7px;background:var(--card);color:inherit;font-family:inherit;font-size:10px}.safety-upload-row label{display:inline-flex;align-items:center;gap:5px;padding:7px 10px;border-radius:7px;background:var(--safety);color:white;font-size:10px;font-weight:700;cursor:pointer}.safety-upload-row input[type=file]{display:none}.safety-upload-row label.is-disabled{opacity:.5}
.safety-capa-list label{display:flex;align-items:flex-start;gap:8px;padding:7px;border-bottom:1px dashed var(--border);cursor:pointer}.safety-capa-list label span{display:flex;flex-direction:column}.safety-capa-list label b{font-size:10px}.safety-capa-list label small{color:var(--muted);font-size:9px}.safety-capa-list label.is-done b{text-decoration:line-through;color:var(--muted)}.safety-capa-add{display:grid;grid-template-columns:1fr 130px auto;gap:6px;margin-top:8px}.safety-capa-add input,.safety-risk-form textarea,.safety-risk-form select{min-width:0;padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:inherit;font-family:inherit;font-size:10px}.safety-risk-form{display:grid;grid-template-columns:1fr auto auto auto;gap:6px;margin-top:8px;padding:9px;border:1px solid var(--border);border-radius:8px}.safety-risk-form textarea{resize:vertical}.safety-risk-form label{font-size:9px;color:var(--muted)}.safety-risk-form select{display:block;margin-top:2px}
.safety-timeline{list-style:none;margin:0;padding:0 0 0 6px}.safety-timeline li{position:relative;display:flex;gap:10px;padding:0 0 14px}.safety-timeline li:before{content:"";position:absolute;left:4px;top:8px;bottom:-2px;width:1px;background:var(--border)}.safety-timeline li:last-child:before{display:none}.safety-timeline i{z-index:1;width:9px;height:9px;margin-top:3px;border:2px solid var(--card);border-radius:50%;background:var(--safety)}.safety-timeline span{display:flex;flex-direction:column}.safety-timeline b{font-size:10px}.safety-timeline small{font-size:8px;color:var(--muted)}.safety-drawer>footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 22px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--card) 94%,var(--safety-pale))}
.safety-dialog{position:absolute;top:50%;left:50%;width:min(620px,94vw);max-height:90vh;overflow:auto;transform:translate(-50%,-50%);border-radius:13px;background:var(--card);box-shadow:0 30px 80px rgba(15,23,42,.3)}.safety-dialog>header{display:flex;justify-content:space-between;align-items:center;padding:18px 20px;border-bottom:1px solid var(--border)}.safety-dialog h2{margin:3px 0;font-size:18px}.safety-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:18px 20px}.safety-form-grid label{display:flex;flex-direction:column;gap:4px}.safety-form-grid label>span,.safety-form-grid>div>span{font-size:10px;font-weight:650}.safety-form-grid input,.safety-form-grid select{height:36px;padding:0 9px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:inherit;font-family:inherit}.safety-form-grid .safety-check{flex-direction:row;align-items:center;font-size:10px}.safety-form-grid .safety-check input{height:auto}.safety-file-pick{grid-column:1/-1;display:flex;flex-direction:column;gap:4px}.safety-file-pick small{font-size:9px;color:var(--muted)}.safety-dialog>footer{display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid var(--border)}
.safety-dropzone{position:relative;display:grid;place-items:center;min-height:104px;padding:14px;border:1.5px dashed var(--border);border-radius:10px;background:var(--surface-2);text-align:center;transition:border-color .15s ease,background-color .15s ease}.safety-dropzone.is-drag-over{border-color:var(--safety);background:var(--safety-pale)}.safety-dropzone.has-file{border-style:solid;background:var(--card)}.safety-dropzone-input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer}.safety-dropzone.has-file .safety-dropzone-input{pointer-events:none}.safety-dropzone-empty{display:flex;flex-direction:column;align-items:center;gap:4px;color:var(--muted)}.safety-dropzone-empty svg{color:var(--safety)}.safety-dropzone-empty b{font-size:11px;font-weight:650;color:var(--ink)}.safety-dropzone-empty small{font-size:9px}.safety-dropzone-file{position:relative;z-index:1;display:flex;align-items:center;gap:8px;color:var(--safety)}.safety-dropzone-file b{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--ink)}.safety-dropzone-file small{font-size:9px;color:var(--muted)}.safety-dropzone-file button{display:grid;place-items:center;width:22px;height:22px;border:1px solid var(--border);border-radius:50%;background:var(--card);color:var(--muted);cursor:pointer}
.safety-shell :where(button,a,input,select,textarea):focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 38%,transparent);outline-offset:2px}.safety-shell :where(input,select,textarea){font-size:13px}.safety-card h2,.safety-section-head h2{margin:0;font-size:18px}.safety-card header small,.safety-section-head small,.safety-dialog header small{font-size:11px;letter-spacing:.08em}.safety-metric span{font-size:12px}.safety-priority-list time{font-size:13px}.safety-priority-list span b{font-size:13px}.safety-priority-list span small{font-size:11px}.safety-readiness dl div{font-size:12px}.safety-search input{height:40px;font-size:13px}.safety-filter button{min-height:40px;padding:8px 12px;font-size:12px}.safety-task-date small,.safety-task-main small,.safety-task-meta{font-size:11px}.safety-task-main strong{font-size:13.5px}.safety-task-evidence{font-size:12px}.safety-status,.safety-urgency{font-size:11px}.safety-empty{font-size:13px}.safety-section-head p{font-size:13px}.safety-count-chip{font-size:11px}.safety-evidence-card b{font-size:13px}.safety-evidence-card em{font-size:11px}.safety-evidence-task{font-size:11px}.safety-evidence-task-context b{font-size:13px}.safety-evidence-task-context small{font-size:11px}.safety-certificate-list article small{font-size:10.5px}.safety-certificate-list h3{font-size:14px}.safety-certificate-list p{font-size:12px}.safety-certificate-list dt,.safety-renewal{font-size:11px}.safety-certificate-list dd{font-size:12px}.safety-calendar-head h2{font-size:18px}.safety-calendar-head button{width:40px;height:40px}.safety-calendar-grid{border-radius:14px}.safety-weekday{min-height:40px;display:grid;place-items:center;padding:8px;text-align:center;background:var(--surface-2);color:var(--muted);font-size:12px;font-weight:800}.safety-weekday.is-weekend{background:color-mix(in srgb,var(--danger) 9%,var(--card));color:color-mix(in srgb,var(--danger) 88%,var(--ink))}.safety-days>.safety-day{min-height:140px;padding:9px}.safety-day.is-weekend:not(.is-blank){background:color-mix(in srgb,var(--danger) 5%,var(--card))}.safety-day.is-weekend>b{color:color-mix(in srgb,var(--danger) 88%,var(--ink))}.safety-days>.safety-day.is-blank{background:var(--surface-2);opacity:.68}.safety-days>.safety-day>b{display:inline-flex;align-items:center;justify-content:center;min-width:25px;height:25px;margin-bottom:6px;font-size:12px}.safety-days button{min-height:32px;padding:6px 7px;border:1px solid color-mix(in srgb,var(--border) 72%,transparent);border-left:3px solid #64748b;border-radius:7px;background:color-mix(in srgb,var(--primary-soft) 48%,var(--card));color:var(--ink);font-size:11px;font-weight:700;transition:background-color .18s ease,border-color .18s ease}.safety-days button:hover{background:var(--primary-soft);border-color:color-mix(in srgb,var(--primary) 28%,var(--border))}.safety-reference{font-size:10px}.safety-drawer>header p{font-size:12px}.safety-drawer-status>span:last-child{font-size:11px}.safety-drawer-body h3{font-size:14px}.safety-drawer-body h3>span{font-size:11px}.safety-detail-grid dt{font-size:11px}.safety-detail-grid dd{font-size:13px}.safety-description{font-size:12px}.safety-inline-link,.safety-risk-toggle{font-size:12px}.safety-requirements b{font-size:12px}.safety-requirements small{font-size:10px}.safety-requirements strong{font-size:11px}.safety-files a{font-size:12px}.safety-upload-row select,.safety-upload-row label{min-height:38px;font-size:12px}.safety-capa-list label b{font-size:12px}.safety-capa-list label small{font-size:10px}.safety-capa-add input,.safety-risk-form textarea,.safety-risk-form select{font-size:12px}.safety-risk-form label{font-size:11px}.safety-timeline b{font-size:12px}.safety-timeline small{font-size:10px}.safety-form-grid label>span,.safety-form-grid .safety-check{font-size:12px}.safety-form-grid input,.safety-form-grid select{height:40px}.safety-file-pick small{font-size:11px}.safety-dropzone-empty b,.safety-dropzone-file b{font-size:13px}.safety-dropzone-empty small,.safety-dropzone-file small{font-size:11px}.safety-inspection-result>header span{font-size:12px}.safety-inspection-result>header b{font-size:10px}.safety-inspection-summary,.safety-inspection-item b{font-size:11px}.safety-inspection-item small,.safety-inspection-item>a{font-size:10px}
@media(prefers-reduced-motion:reduce){.safety-panel,.safety-drawer{animation:none}.safety-link-button,.safety-days button{transition:none}}
@media(max-width:1023px){.safety-metrics{grid-template-columns:repeat(3,1fr)}.safety-overview-grid{grid-template-columns:1fr}.safety-evidence-grid{grid-template-columns:repeat(2,1fr)}.safety-task-row{grid-template-columns:48px minmax(200px,1fr) 115px 18px}.safety-task-evidence,.safety-task-row>.safety-urgency{display:none}.safety-certificate-list article{grid-template-columns:40px minmax(190px,1fr) 120px 100px 68px}.safety-certificate-list article dl:first-of-type{display:none}}
@media(max-width:767px){.safety-shell{padding:14px}.safety-hero{display:block;padding:20px}.safety-hero p{font-size:11px}.safety-hero-actions{margin-top:13px}.safety-fiscal{display:none}.safety-tabs{margin:12px -2px}.safety-tabs button{padding:9px 11px}.safety-tabs button span{font-size:11px}.safety-metrics{grid-template-columns:repeat(2,1fr)}.safety-metric{padding:12px}.safety-metric strong{font-size:20px}.safety-overview-grid{margin-top:10px}.safety-readiness{display:none}.safety-priority-list>button{grid-template-columns:52px 1fr}.safety-priority-list .safety-status{display:none}.safety-toolbar{display:block}.safety-search{min-width:0;margin-bottom:8px}.safety-filter{overflow-x:auto}.safety-task-row{grid-template-columns:44px minmax(0,1fr) 18px;padding:11px 10px;gap:8px}.safety-task-row>.safety-status,.safety-task-row>.safety-task-evidence,.safety-task-row>.safety-urgency{display:none}.safety-task-main strong{white-space:normal}.safety-task-meta{font-size:8px}.safety-calendar-grid{display:none}.safety-calendar-agenda.safety-agenda{display:flex;flex-direction:column;border:1px solid var(--border);border-radius:9px;background:var(--card)}.safety-calendar-agenda>button{display:grid;grid-template-columns:75px 1fr auto;align-items:center;gap:8px;padding:10px;border:0;border-bottom:1px solid var(--border);background:transparent;color:inherit;text-align:left;font-family:inherit}.safety-calendar-agenda time{font-size:9px;color:var(--safety)}.safety-calendar-agenda span:nth-child(2){display:flex;flex-direction:column}.safety-calendar-agenda b{font-size:10px}.safety-calendar-agenda small{font-size:8px;color:var(--muted)}.safety-section-head{align-items:flex-start}.safety-section-head p{font-size:10px}.safety-evidence-grid{grid-template-columns:1fr}.safety-certificate-list article{grid-template-columns:38px minmax(0,1fr) 68px;gap:8px}.safety-certificate-list article dl,.safety-certificate-list .safety-renewal{display:none}.safety-drawer{width:100vw}.safety-drawer>header{padding:16px}.safety-drawer-status{padding:8px 16px}.safety-drawer-status>span:last-child{display:none}.safety-drawer-body{padding:0 16px 22px}.safety-detail-grid{grid-template-columns:1fr}.safety-capa-add{grid-template-columns:1fr auto}.safety-capa-add input[type=date]{display:none}.safety-risk-form{grid-template-columns:1fr 1fr}.safety-risk-form textarea{grid-column:1/-1}.safety-drawer>footer{padding:10px 16px}.safety-form-grid{grid-template-columns:1fr}.safety-file-pick{grid-column:auto}}
@media(max-width:767px){.safety-shell{padding:0}.safety-page-header{padding:16px}.safety-tabs button span{font-size:12px}.safety-task-meta{font-size:10px}.safety-calendar-agenda time{font-size:11px}.safety-calendar-agenda b{font-size:12px}.safety-calendar-agenda small{font-size:10px}.safety-section-head p{font-size:12px}}
@media(prefers-reduced-motion:reduce){.safety-evidence-preview img,.safety-evidence-view-action,.safety-evidence-group-toggle,.safety-evidence-file-row>a{transition:none}}
@media(max-width:767px){.safety-section-head{display:block}.safety-section-actions{justify-content:flex-start;flex-wrap:wrap;gap:6px;margin-top:10px}.safety-evidence-group-toggle{min-height:60px;padding:11px}.safety-evidence-group-body{padding:8px}.safety-evidence-lightbox{padding:10px}.safety-evidence-lightbox-dialog{width:100%;max-height:92vh}.safety-evidence-lightbox-dialog>header{padding:13px 14px}.safety-evidence-lightbox-image{padding:10px}.safety-evidence-lightbox-image img{max-height:66vh}.safety-evidence-lightbox-dialog>footer{align-items:flex-start;flex-direction:column;padding:10px 14px}}
.safety-evidence-toolbar{display:flex;align-items:center;gap:8px;margin:14px 0}.safety-evidence-search{display:flex;align-items:center;flex:1;min-width:240px;gap:8px;min-height:40px;padding:0 10px;border:1px solid var(--border);border-radius:9px;background:var(--card);color:var(--muted);transition:border-color .18s ease,box-shadow .18s ease}.safety-evidence-search:focus-within{border-color:var(--safety);box-shadow:0 0 0 3px color-mix(in srgb,var(--safety) 12%,transparent)}.safety-evidence-search>span{color:var(--ink);font-size:11px;font-weight:750;white-space:nowrap}.safety-evidence-search input{width:100%;min-width:0;height:36px;border:0;outline:0;background:transparent;color:var(--ink);font-family:inherit;font-size:12px}.safety-evidence-search input::placeholder{color:var(--muted)}.safety-evidence-clear{min-height:34px;padding:0 10px;border:1px solid var(--border);border-radius:7px;background:var(--card);color:var(--muted);font-family:inherit;font-size:10px;font-weight:700;cursor:pointer}.safety-evidence-clear:hover{border-color:var(--safety);color:var(--safety);background:var(--safety-pale)}.safety-evidence-subgroups{display:flex;flex-direction:column;gap:8px}.safety-evidence-subgroup{border:1px solid color-mix(in srgb,var(--border) 86%,var(--safety));border-radius:9px;background:var(--card);overflow:hidden}.safety-evidence-subgroup-toggle{display:flex;align-items:center;justify-content:space-between;width:100%;min-height:48px;gap:10px;padding:9px 11px;border:0;background:var(--card);color:inherit;text-align:left;font-family:inherit;cursor:pointer;transition:background-color .18s ease}.safety-evidence-subgroup-toggle:hover{background:color-mix(in srgb,var(--safety) 5%,var(--card))}.safety-evidence-subgroup-toggle .safety-evidence-group-heading{gap:7px}.safety-evidence-subgroup-toggle .safety-evidence-group-heading b{font-size:12px}.safety-evidence-subgroup-toggle .safety-evidence-group-heading small{font-size:9px}.safety-evidence-subgroup-body{padding:8px;border-top:1px solid var(--border);background:color-mix(in srgb,var(--surface-2) 32%,var(--card))}
@media(prefers-reduced-motion:reduce){.safety-evidence-search,.safety-evidence-clear,.safety-evidence-subgroup-toggle{transition:none}}
@media(max-width:767px){.safety-evidence-toolbar{align-items:stretch;flex-direction:column}.safety-evidence-search{min-width:0}.safety-evidence-clear{align-self:flex-start}}
`
