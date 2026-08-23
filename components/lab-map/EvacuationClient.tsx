'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { PageHeader } from '@/components/ui/PageHeader'
import { uploadFileWithProgress } from '@/lib/documents/upload-with-progress'
import type { AssemblyPointDTO, LabMapDTO } from '@/lib/lab-map/types'
import type {
  EvacuationDashboardDTO,
  EvacuationDrillCycleDTO,
  EvacuationDrillSessionDTO,
  EvacuationExitAssignmentDTO,
  EvacuationPlanDTO,
  EvacuationTaskDTO,
} from '@/lib/lab-map/evacuation'
import { EvacuationStyles } from './EvacuationStyles'
import { GoogleMapEmbed } from './GoogleMapEmbed'
import { SafetyPhotoPicker } from './SafetyPhotoPicker'

type Tab = 'overview' | 'plan' | 'assembly' | 'drills' | 'tasks'
type PointDraft = {
  id?: string
  code: string
  nameTh: string
  detailTh: string
  pointType: 'assembly' | 'safe'
  latitude: string
  longitude: string
  exitCodes: string[]
  updatedAt?: string
}
type AssignmentDraft = {
  scopeType: 'station' | 'space' | 'zone'
  scopeCode: string
  exitCode: string
  routeVariant: 'primary' | 'alternate'
  routeCode: string
  assemblyPointId: string
  postExitInstructionTh: string
  responsibleText: string
}
type PlanDraft = {
  id?: string
  planCode: string
  versionCode: string
  mapReleaseId: string
  effectiveDate: string
  reviewDueDate: string
  reportPointId: string
  headcountResponsible: string
  notes: string
  reviewTaskKey: string
  updatedAt?: string
  assignments: AssignmentDraft[]
}
type CycleDraft = {
  fiscalYear: string
  planVersionId: string
  ownerText: string
  dueDate: string
  notes: string
  taskKey: string
}
type SessionDraft = {
  cycleId: string
  scenario: string
  startedAt: string
  endedAt: string
  offHours: boolean
  scopeCodes: string
  routeCodes: string
  expectedParticipants: string
  actualParticipants: string
  expectedHeadcount: string
  checkedHeadcount: string
  missingHeadcount: string
  injuredCount: string
  reportPointId: string
  observerText: string
  evaluation: string
  compliancePercent: string
  deviationText: string
  status: 'planned' | 'completed'
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview', label: 'ภาพรวม', icon: 'chart' },
  { id: 'plan', label: 'แผนและเส้นทาง', icon: 'route' },
  { id: 'assembly', label: 'จุดรวมพล', icon: 'globe' },
  { id: 'drills', label: 'การซ้อมประจำปี', icon: 'calendar' },
  { id: 'tasks', label: 'งานและหลักฐาน', icon: 'clipboard' },
]

const PLAN_TASK_KEYS = new Set(['CBH-ST-15', 'CBH-ST-21'])
const DRILL_TASK_KEYS = new Set(['CBH-ST-17', 'CBH-ST-21'])
const EXIT_CODES = ['exit-3a', 'exit-3b', 'exit-3c']
const EVIDENCE_ROLES = ['plan', 'attendance', 'evaluation', 'photo', 'incident'] as const
const EVIDENCE_ROLE_LABELS: Record<typeof EVIDENCE_ROLES[number], string> = {
  plan: 'แผน/กำหนดการ', attendance: 'ผู้เข้าร่วม/นับคน', evaluation: 'ผลประเมิน', photo: 'ภาพถ่าย', incident: 'เหตุผิดปกติ',
}
const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: 'แบบร่าง', in_review: 'รอทบทวน', approved: 'อนุมัติแล้ว', published: 'เผยแพร่', retired: 'เลิกใช้',
}
const CYCLE_STATUS_LABELS: Record<string, string> = {
  planned: 'วางแผนแล้ว', in_progress: 'กำลังดำเนินการ', awaiting_evidence: 'รอหลักฐาน', pending_review: 'รอตรวจงาน', completed: 'เสร็จสิ้น', cancelled: 'ยกเลิก',
}
const SESSION_STATUS_LABELS: Record<string, string> = { planned: 'นัดหมาย', completed: 'บันทึกผลแล้ว', cancelled: 'ยกเลิก' }

function statusTone(status: string) {
  if (['published', 'approved', 'completed'].includes(status)) return 'green'
  if (['in_review', 'awaiting_evidence', 'pending_review', 'in_progress'].includes(status)) return 'amber'
  if (['retired', 'cancelled'].includes(status)) return 'gray'
  return 'blue'
}

function Status({ value, labels }: { value: string; labels: Record<string, string> }) {
  return <span className="evac-status" data-tone={statusTone(value)}>{labels[value] ?? value}</span>
}

function todayIso() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('th-TH', { dateStyle: 'medium' })
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatDuration(seconds: number | null) {
  if (seconds == null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes} นาที ${remainder.toString().padStart(2, '0')} วินาที`
}

function localDateTimeToIso(value: string) {
  return value ? new Date(value).toISOString() : null
}

function toLocalDateTimeInput(value: string | null | undefined) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function splitCodes(value: string) {
  return [...new Set(value.split(',').map(item => item.trim()).filter(Boolean))]
}

async function jsonRequest<T = any>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? 'ดำเนินการไม่สำเร็จ')
  return (json.data ?? json) as T
}

function taskReference(task: EvacuationTaskDTO | undefined) {
  if (!task) return null
  if (task.instanceId) return { instanceId: task.instanceId }
  if (task.scheduleId && task.periodStart) return { scheduleId: task.scheduleId, periodStart: task.periodStart }
  return null
}

function taskLabel(task: EvacuationTaskDTO) {
  return `${task.sourceKey ?? task.key} · ${task.title} · ${task.periodLabel}`
}

function defaultAssignments(map: LabMapDTO, points: AssemblyPointDTO[]): AssignmentDraft[] {
  const routes = map.routes.filter(route => route.kind === 'evacuation')
  const scopes = [...new Set(routes.map(route => route.fromStationCode))]
  const pointId = points.find(point => point.lifecycleStatus === 'active' && point.pointType !== 'safe')?.id ?? points.find(point => point.lifecycleStatus === 'active')?.id ?? ''
  return scopes.flatMap(scopeCode => {
    const primary = routes.find(route => route.fromStationCode === scopeCode && route.variant === 'primary')
    const alternate = routes.find(route => route.fromStationCode === scopeCode && route.variant === 'alternate')
    return [primary, alternate].filter((route): route is NonNullable<typeof route> => Boolean(route)).map(route => ({
      scopeType: scopeCode === 'office' ? 'station' : scopeCode.includes('corridor') ? 'zone' : 'space',
      scopeCode,
      exitCode: route.destinationCode,
      routeVariant: route.variant,
      routeCode: route.code,
      assemblyPointId: pointId,
      postExitInstructionTh: 'ไปยังจุดรวมพล ห้ามย้อนกลับเข้าอาคาร และรอการนับคน',
      responsibleText: '',
    }))
  })
}

function planToDraft(plan: EvacuationPlanDTO | null, dashboard: EvacuationDashboardDTO): PlanDraft {
  const firstRelease = dashboard.releases.find(release => release.status === 'published') ?? dashboard.releases[0]
  const firstPoint = dashboard.assemblyPoints.find(point => point.lifecycleStatus === 'active' && point.pointType !== 'safe') ?? dashboard.assemblyPoints[0]
  const firstTask = dashboard.tasks.find(task => PLAN_TASK_KEYS.has(task.sourceKey ?? '') && taskReference(task))
  return {
    id: plan?.id,
    planCode: plan?.planCode ?? 'EVAC-F3',
    versionCode: plan?.versionCode ?? `EVAC-${todayIso().replaceAll('-', '')}`,
    mapReleaseId: plan?.mapReleaseId ?? firstRelease?.id ?? '',
    effectiveDate: plan?.effectiveDate ?? todayIso(),
    reviewDueDate: plan?.reviewDueDate ?? '',
    reportPointId: plan?.reportPointId ?? firstPoint?.id ?? '',
    headcountResponsible: plan?.headcountResponsible ?? '',
    notes: plan?.notes ?? '',
    reviewTaskKey: dashboard.tasks.find(task => task.link?.sourceId === plan?.id && PLAN_TASK_KEYS.has(task.sourceKey ?? ''))?.key ?? firstTask?.key ?? '',
    updatedAt: plan?.updatedAt,
    assignments: plan?.assignments.map(assignment => ({
      scopeType: assignment.scopeType, scopeCode: assignment.scopeCode, exitCode: assignment.exitCode,
      routeVariant: assignment.routeVariant, routeCode: assignment.routeCode ?? '', assemblyPointId: assignment.assemblyPointId,
      postExitInstructionTh: assignment.postExitInstructionTh ?? '', responsibleText: assignment.responsibleText ?? '',
    })) ?? defaultAssignments(dashboard.map, dashboard.assemblyPoints),
  }
}

function cycleToDraft(cycle: EvacuationDrillCycleDTO | null, dashboard: EvacuationDashboardDTO): CycleDraft {
  const plan = dashboard.plans.find(item => item.id === cycle?.planVersionId) ?? dashboard.plans.find(item => ['approved', 'published'].includes(item.status))
  const task = dashboard.tasks.find(item => item.instanceId === cycle?.taskInstanceId && DRILL_TASK_KEYS.has(item.sourceKey ?? '')) ?? dashboard.tasks.find(item => DRILL_TASK_KEYS.has(item.sourceKey ?? '') && taskReference(item))
  return {
    fiscalYear: String(cycle?.fiscalYear ?? Number(todayIso().slice(0, 4)) + (Number(todayIso().slice(5, 7)) >= 10 ? 544 : 543)),
    planVersionId: cycle?.planVersionId ?? plan?.id ?? '', ownerText: cycle?.ownerText ?? '', dueDate: cycle?.dueDate ?? '', notes: cycle?.notes ?? '', taskKey: task?.key ?? '',
  }
}

function sessionToDraft(cycle: EvacuationDrillCycleDTO | null, session: EvacuationDrillSessionDTO | null, points: AssemblyPointDTO[]): SessionDraft {
  const point = points.find(item => item.id === session?.reportPointId) ?? points.find(item => item.pointType !== 'safe')
  return {
    cycleId: session?.cycleId ?? cycle?.id ?? '', scenario: session?.scenario ?? 'ซ้อมอพยพประจำปี',
    startedAt: toLocalDateTimeInput(session?.startedAt), endedAt: toLocalDateTimeInput(session?.endedAt),
    offHours: session?.offHours ?? false, scopeCodes: session?.scopeCodes.join(', ') ?? '', routeCodes: session?.routeCodes.join(', ') ?? '',
    expectedParticipants: String(session?.expectedParticipants ?? 0), actualParticipants: String(session?.actualParticipants ?? 0),
    expectedHeadcount: String(session?.expectedHeadcount ?? 0), checkedHeadcount: String(session?.checkedHeadcount ?? 0), missingHeadcount: String(session?.missingHeadcount ?? 0), injuredCount: String(session?.injuredCount ?? 0),
    reportPointId: session?.reportPointId ?? point?.id ?? '', observerText: session?.observerText ?? '', evaluation: session?.evaluation ?? '', compliancePercent: session?.compliancePercent == null ? '' : String(session.compliancePercent), deviationText: session?.deviationText ?? '', status: session?.status === 'completed' ? 'completed' : 'planned',
  }
}

export function EvacuationClient({ initialDashboard, canEdit, canManage }: { initialDashboard: EvacuationDashboardDTO; canEdit: boolean; canManage: boolean }) {
  const [dashboard, setDashboard] = useState(initialDashboard)
  const [tab, setTab] = useState<Tab>('overview')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [planEditorId, setPlanEditorId] = useState<string | 'new'>(initialDashboard.plans[0]?.id ?? 'new')
  const [planDraft, setPlanDraft] = useState<PlanDraft>(() => planToDraft(initialDashboard.plans[0] ?? null, initialDashboard))
  const [pointId, setPointId] = useState<string | null>(initialDashboard.assemblyPoints[0]?.id ?? null)
  const [pointDraft, setPointDraft] = useState<PointDraft | null>(null)
  const [pointFile, setPointFile] = useState<File | null>(null)
  const [pointNote, setPointNote] = useState('')
  const [pointAccuracy, setPointAccuracy] = useState('')
  const [cycleEditorId, setCycleEditorId] = useState<string | 'new'>(initialDashboard.cycles[0]?.id ?? 'new')
  const [cycleDraft, setCycleDraft] = useState<CycleDraft>(() => cycleToDraft(initialDashboard.cycles[0] ?? null, initialDashboard))
  const [sessionEditorId, setSessionEditorId] = useState<string | 'new'>('new')
  const [sessionDraft, setSessionDraft] = useState<SessionDraft>(() => sessionToDraft(initialDashboard.cycles[0] ?? null, null, initialDashboard.assemblyPoints))

  const selectedPlan = planEditorId === 'new' ? null : dashboard.plans.find(plan => plan.id === planEditorId) ?? null
  const selectedPoint = dashboard.assemblyPoints.find(point => point.id === pointId) ?? null
  const selectedCycle = cycleEditorId === 'new' ? null : dashboard.cycles.find(cycle => cycle.id === cycleEditorId) ?? null
  const selectedSession = sessionEditorId === 'new'
    ? null
    : selectedCycle?.sessions.find(session => session.id === sessionEditorId) ?? dashboard.cycles.flatMap(cycle => cycle.sessions).find(session => session.id === sessionEditorId) ?? null
  const planTasks = useMemo(() => dashboard.tasks.filter(task => PLAN_TASK_KEYS.has(task.sourceKey ?? '')), [dashboard.tasks])
  const drillTasks = useMemo(() => dashboard.tasks.filter(task => DRILL_TASK_KEYS.has(task.sourceKey ?? '')), [dashboard.tasks])
  const publishedPlan = dashboard.plans.find(plan => plan.status === 'published') ?? dashboard.plans.find(plan => plan.status === 'approved') ?? null
  const unresolvedEvidence = dashboard.tasks.flatMap(task => task.requirements.filter(requirement => requirement.required && requirement.attachedCount < requirement.minimumFiles).map(requirement => ({ task, requirement })))

  useEffect(() => {
    if (planEditorId !== 'new') {
      const plan = dashboard.plans.find(item => item.id === planEditorId) ?? null
      setPlanDraft(planToDraft(plan, dashboard))
    } else if (!planDraft.id) {
      setPlanDraft(planToDraft(null, dashboard))
    }
    // Reloading after a save intentionally rehydrates the selected editor from the server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planEditorId, selectedPlan?.updatedAt, dashboard.releases.length, dashboard.assemblyPoints.length])

  useEffect(() => {
    if (cycleEditorId !== 'new') {
      const cycle = dashboard.cycles.find(item => item.id === cycleEditorId) ?? null
      setCycleDraft(cycleToDraft(cycle, dashboard))
      setSessionDraft(sessionToDraft(cycle, null, dashboard.assemblyPoints))
      setSessionEditorId('new')
    } else if (!cycleDraft.planVersionId) {
      setCycleDraft(cycleToDraft(null, dashboard))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleEditorId, selectedCycle?.updatedAt, dashboard.plans.length, dashboard.tasks.length])

  useEffect(() => {
    if (!selectedPoint || pointDraft) return
    setPointDraft(null)
    setPointFile(null)
    setPointNote('')
    setPointAccuracy('')
  }, [selectedPoint, pointDraft])

  async function refresh(message?: string) {
    setLoading(true)
    setError('')
    try {
      const next = await jsonRequest<EvacuationDashboardDTO>('/api/admin/lab-map/evacuation')
      setDashboard(next)
      if (message) setNotice(message)
    } catch (cause) {
      setError((cause as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function run(action: () => Promise<void>, successMessage?: string) {
    setBusy(true); setError(''); setNotice('')
    try { await action(); if (successMessage) setNotice(successMessage) }
    catch (cause) { setError((cause as Error).message) }
    finally { setBusy(false) }
  }

  function startNewPlan() { setPlanEditorId('new'); setPlanDraft(planToDraft(null, dashboard)); setTab('plan'); setError(''); setNotice('') }
  function selectPlan(id: string) { setPlanEditorId(id); setTab('plan'); setError(''); setNotice('') }
  function startNewPoint(pointType: 'assembly' | 'safe') { setPointId(null); setPointFile(null); setPointDraft({ code: '', nameTh: '', detailTh: '', pointType, latitude: '', longitude: '', exitCodes: [] }); setTab('assembly') }
  function editPoint(point: AssemblyPointDTO) { setPointDraft({ id: point.id, code: point.code, nameTh: point.nameTh, detailTh: point.detailTh ?? '', pointType: point.pointType ?? 'assembly', latitude: point.latitude == null ? '' : String(point.latitude), longitude: point.longitude == null ? '' : String(point.longitude), exitCodes: [...point.exitCodes], updatedAt: point.updatedAt }); setPointFile(null); setPointNote(''); setPointAccuracy('') }
  function selectCycle(id: string) { setCycleEditorId(id); setTab('drills'); setError(''); setNotice('') }

  async function savePlan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const task = dashboard.tasks.find(item => item.key === planDraft.reviewTaskKey)
    const reference = taskReference(task)
    if (!reference) { setError('กรุณาเลือกงานทบทวนแผนที่มีรอบงาน หรือเปิดงานในโมดูลงานและหลักฐานก่อน'); return }
    if (!planDraft.planCode.trim() || !planDraft.versionCode.trim() || !planDraft.mapReleaseId) { setError('กรุณากรอกรหัสแผน รหัส version และ map release'); return }
    if (!planDraft.headcountResponsible.trim()) { setError('กรุณาระบุผู้รับผิดชอบการนับคน/รายงานตัว'); return }
    if (!planDraft.assignments.length || planDraft.assignments.some(item => !item.scopeCode.trim() || !item.exitCode || !item.assemblyPointId || !item.routeCode)) { setError('ทุกพื้นที่ต้องมีทางออก จุดรวมพล และ route preset'); return }
    const payload = {
      planCode: planDraft.planCode.trim(), versionCode: planDraft.versionCode.trim(), mapReleaseId: planDraft.mapReleaseId,
      effectiveDate: planDraft.effectiveDate || null, reviewDueDate: planDraft.reviewDueDate || null, reportPointId: planDraft.reportPointId || null,
      headcountResponsible: planDraft.headcountResponsible.trim(), notes: planDraft.notes.trim() || null, reviewTask: reference,
      assignments: planDraft.assignments.map(item => ({ ...item, scopeCode: item.scopeCode.trim(), routeCode: item.routeCode || null, postExitInstructionTh: item.postExitInstructionTh.trim() || null, responsibleText: item.responsibleText.trim() || null })),
    }
    await run(async () => {
      const saved = await jsonRequest<EvacuationPlanDTO>(planDraft.id ? `/api/admin/lab-map/evacuation/plans/${planDraft.id}` : '/api/admin/lab-map/evacuation/plans', { method: planDraft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(planDraft.id ? { ...payload, updatedAt: planDraft.updatedAt } : payload) })
      setPlanEditorId(saved.id)
      await refresh()
    }, 'บันทึกแผนอพยพแล้ว')
  }

  async function transitionPlan(action: 'submit' | 'approve' | 'publish' | 'retire') {
    if (!selectedPlan) return
    await run(async () => { const saved = await jsonRequest<EvacuationPlanDTO>(`/api/admin/lab-map/evacuation/plans/${selectedPlan.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }); setPlanEditorId(saved.id); await refresh() }, `เปลี่ยนสถานะแผนเป็น ${PLAN_STATUS_LABELS[action === 'submit' ? 'in_review' : action === 'approve' ? 'approved' : action === 'publish' ? 'published' : 'retired']}`)
  }

  async function savePoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!pointDraft) return
    const latitude = pointDraft.latitude.trim() ? Number(pointDraft.latitude) : null
    const longitude = pointDraft.longitude.trim() ? Number(pointDraft.longitude) : null
    if (!pointDraft.code.trim() || !pointDraft.nameTh.trim()) { setError('กรุณากรอกรหัสและชื่อจุด'); return }
    if ((latitude == null) !== (longitude == null) || [latitude, longitude].some(value => value != null && Number.isNaN(value))) { setError('Latitude และ Longitude ต้องกรอกเป็นคู่'); return }
    const payload = { code: pointDraft.code.trim(), nameTh: pointDraft.nameTh.trim(), detailTh: pointDraft.detailTh.trim() || null, pointType: pointDraft.pointType, latitude, longitude, exitCodes: pointDraft.exitCodes }
    await run(async () => {
      await jsonRequest(pointDraft.id ? `/api/admin/lab-map/assembly-points/${pointDraft.id}` : '/api/admin/lab-map/assembly-points', { method: pointDraft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pointDraft.id ? { ...payload, code: undefined, updatedAt: pointDraft.updatedAt } : payload) })
      setPointDraft(null); await refresh()
    }, 'บันทึกข้อมูลจุดแล้ว')
  }

  async function verifyPoint() {
    if (!selectedPoint || !pointFile || selectedPoint.latitude == null || selectedPoint.longitude == null) { setError('ต้องมีพิกัดและรูปหลักฐานก่อนยืนยันหน้างาน'); return }
    await run(async () => {
      const signed = await jsonRequest<{ uploadUrl: string; key: string }>(`/api/admin/lab-map/assembly-points/${selectedPoint.id}/verification-photo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: pointFile.name, contentType: pointFile.type, sizeBytes: pointFile.size }) })
      await uploadFileWithProgress(signed.uploadUrl, pointFile, pointFile.type, () => {})
      await jsonRequest(`/api/admin/lab-map/assembly-points/${selectedPoint.id}/verification-photo`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: signed.key, fileName: pointFile.name, latitude: selectedPoint.latitude, longitude: selectedPoint.longitude, accuracyMeters: pointAccuracy ? Number(pointAccuracy) : null, note: pointNote.trim() || null }) })
      setPointFile(null); setPointNote(''); setPointAccuracy(''); await refresh()
    }, 'ยืนยันจุดจากหลักฐานหน้างานแล้ว')
  }

  async function retirePoint() {
    if (!selectedPoint || !confirm(`เลิกใช้${selectedPoint.pointType === 'safe' ? 'จุดปลอดภัย' : 'จุดรวมพล'}นี้หรือไม่`)) return
    await run(async () => { await jsonRequest(`/api/admin/lab-map/assembly-points/${selectedPoint.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ retire: true, updatedAt: selectedPoint.updatedAt }) }); setPointId(null); await refresh() }, 'เลิกใช้จุดแล้ว')
  }

  async function saveCycle(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const task = dashboard.tasks.find(item => item.key === cycleDraft.taskKey)
    const reference = taskReference(task)
    if (!reference || !cycleDraft.planVersionId || !cycleDraft.ownerText.trim()) { setError('กรุณาเลือกแผน งานซ้อม และผู้รับผิดชอบ'); return }
    await run(async () => { const created = await jsonRequest<EvacuationDrillCycleDTO>('/api/admin/lab-map/evacuation/drills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'cycle', fiscalYear: Number(cycleDraft.fiscalYear), planVersionId: cycleDraft.planVersionId, ownerText: cycleDraft.ownerText.trim(), dueDate: cycleDraft.dueDate || null, notes: cycleDraft.notes.trim() || null, task: reference }) }); setCycleEditorId(created.id); await refresh() }, 'สร้างรอบซ้อมและเชื่อมงานแล้ว')
  }

  async function saveSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!sessionDraft.cycleId || !sessionDraft.scenario.trim()) { setError('กรุณาเลือกรอบซ้อมและระบุสถานการณ์'); return }
    const payload = {
      cycleId: sessionDraft.cycleId, scenario: sessionDraft.scenario.trim(), startedAt: localDateTimeToIso(sessionDraft.startedAt), endedAt: localDateTimeToIso(sessionDraft.endedAt), offHours: sessionDraft.offHours,
      scopeCodes: splitCodes(sessionDraft.scopeCodes), routeCodes: splitCodes(sessionDraft.routeCodes), expectedParticipants: Number(sessionDraft.expectedParticipants || 0), actualParticipants: Number(sessionDraft.actualParticipants || 0), expectedHeadcount: Number(sessionDraft.expectedHeadcount || 0), checkedHeadcount: Number(sessionDraft.checkedHeadcount || 0), missingHeadcount: Number(sessionDraft.missingHeadcount || 0), injuredCount: Number(sessionDraft.injuredCount || 0), reportPointId: sessionDraft.reportPointId || null, observerText: sessionDraft.observerText.trim() || null, evaluation: sessionDraft.evaluation.trim() || null, compliancePercent: sessionDraft.compliancePercent === '' ? null : Number(sessionDraft.compliancePercent), deviationText: sessionDraft.deviationText.trim() || null, status: sessionDraft.status,
    }
    await run(async () => {
      const saved = selectedSession
        ? await jsonRequest<EvacuationDrillSessionDTO>(`/api/admin/lab-map/evacuation/drills/${selectedSession.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, updatedAt: selectedSession.updatedAt }) })
        : await jsonRequest<EvacuationDrillSessionDTO>('/api/admin/lab-map/evacuation/drills', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'session', ...payload }) })
      setSessionEditorId(saved.id); await refresh()
    }, 'บันทึกผลการซ้อมแล้ว')
  }

  async function linkEvidence(session: EvacuationDrillSessionDTO, attachmentId: string, evidenceRole: typeof EVIDENCE_ROLES[number]) {
    const existing = session.evidence.filter(item => item.attachmentId !== attachmentId)
    await run(async () => { await jsonRequest(`/api/admin/lab-map/evacuation/drills/${session.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ updatedAt: session.updatedAt, evidence: [...existing, { attachmentId, evidenceRole }] }) }); await refresh() }, 'เชื่อมหลักฐานกับผลการซ้อมแล้ว')
  }

  return <div className="evac-page">
    <EvacuationStyles />
    <PageHeader eyebrow="ความปลอดภัย · QP-LAB-26 / MN-LAB-02" title="จุดรวมพล / แผนอพยพ" subtitle="จัดการแผน เส้นทาง จุดรายงานตัว การซ้อมประจำปี และหลักฐานใน workflow เดียว" actions={<>
      <Link className="evac-link" href="/staff/lab-map/print">พิมพ์แผนที่ A3/A4</Link>
      <Button variant="secondary" size="lg" icon="download" onClick={() => window.print()}>พิมพ์หน้านี้</Button>
      {canEdit ? <Button size="lg" icon="plus" onClick={startNewPlan}>สร้างแผนฉบับใหม่</Button> : null}
    </>} />
    <div className="evac-tabs" role="tablist" aria-label="ส่วนของโมดูลจุดรวมพลและแผนอพยพ">
      {TABS.map(item => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} aria-controls={`evac-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} onClick={() => setTab(item.id)}><Icon name={item.icon} size={16} />{item.label}</button>)}
    </div>
    {error ? <div className="evac-alert" role="alert">{error}</div> : null}
    {notice ? <div className="evac-notice" role="status" aria-live="polite">{notice}</div> : null}
    {loading ? <div className="evac-skeleton" role="status" aria-live="polite">กำลังโหลดข้อมูลล่าสุด…</div> : null}
    {tab === 'overview' ? <OverviewPanel dashboard={dashboard} unresolvedEvidence={unresolvedEvidence.length} onSelectPlan={selectPlan} onNewPlan={startNewPlan} onTab={setTab} /> : null}
    {tab === 'plan' ? <PlanPanel dashboard={dashboard} canEdit={canEdit} canManage={canManage} busy={busy} selectedPlan={selectedPlan} planEditorId={planEditorId} planDraft={planDraft} setPlanEditorId={setPlanEditorId} setPlanDraft={setPlanDraft} onNew={startNewPlan} onSelect={selectPlan} onSave={savePlan} onTransition={transitionPlan} /> : null}
    {tab === 'assembly' ? <AssemblyPanel dashboard={dashboard} canEdit={canEdit} canManage={canManage} busy={busy} selectedPoint={selectedPoint} pointDraft={pointDraft} setPointDraft={setPointDraft} setPointId={setPointId} pointFile={pointFile} setPointFile={setPointFile} pointNote={pointNote} setPointNote={setPointNote} pointAccuracy={pointAccuracy} setPointAccuracy={setPointAccuracy} onNew={startNewPoint} onEdit={editPoint} onSave={savePoint} onVerify={verifyPoint} onRetire={retirePoint} /> : null}
    {tab === 'drills' ? <DrillsPanel dashboard={dashboard} canEdit={canEdit} busy={busy} selectedCycle={selectedCycle} selectedSession={selectedSession} cycleEditorId={cycleEditorId} cycleDraft={cycleDraft} sessionDraft={sessionDraft} setCycleEditorId={setCycleEditorId} setCycleDraft={setCycleDraft} setSessionEditorId={setSessionEditorId} setSessionDraft={setSessionDraft} onSaveCycle={saveCycle} onSaveSession={saveSession} onLinkEvidence={linkEvidence} /> : null}
    {tab === 'tasks' ? <TasksPanel dashboard={dashboard} onTab={setTab} /> : null}
  </div>
}

function OverviewPanel({ dashboard, unresolvedEvidence, onSelectPlan, onNewPlan, onTab }: { dashboard: EvacuationDashboardDTO; unresolvedEvidence: number; onSelectPlan: (id: string) => void; onNewPlan: () => void; onTab: (tab: Tab) => void }) {
  const activePoints = dashboard.assemblyPoints.filter(point => point.lifecycleStatus === 'active')
  const latestCycle = dashboard.cycles[0]
  return <section className="evac-panel" id="evac-panel-overview" role="tabpanel" aria-label="ภาพรวม">
    <div className="evac-grid">
      <div className="evac-metric"><span>แผนที่เผยแพร่</span><strong>{dashboard.plans.filter(plan => plan.status === 'published').length}</strong><small>{dashboard.plans.find(plan => plan.status === 'published')?.versionCode ?? 'ยังไม่มีแผนใช้งาน'}</small></div>
      <div className="evac-metric"><span>จุดที่ใช้งาน</span><strong>{activePoints.length}</strong><small>{activePoints.filter(point => point.verified).length} จุดยืนยัน GPS แล้ว</small></div>
      <div className="evac-metric"><span>อัตราซ้อมเสร็จ</span><strong>{dashboard.metrics.completedRate}%</strong><small>เฉลี่ย {formatDuration(dashboard.metrics.averageDurationSeconds)}</small></div>
      <div className="evac-metric"><span>ความพร้อมนับคน</span><strong>{dashboard.metrics.headcountReadyRate == null ? '—' : `${dashboard.metrics.headcountReadyRate}%`}</strong><small>จากผลซ้อมที่บันทึก</small></div>
    </div>
    <div className="evac-grid-2">
      <article className="evac-card"><div className="evac-card-head"><div><h2>สถานะควบคุมแผน</h2><p>แผนที่เผยแพร่ต้องผ่านการทบทวน อนุมัติ และตรวจ gate จุด/ทางออกก่อนใช้งาน</p></div>{dashboard.plans.find(plan => plan.status === 'published') ? <Status value="published" labels={PLAN_STATUS_LABELS} /> : <Status value="draft" labels={PLAN_STATUS_LABELS} />}</div>
        {dashboard.plans.find(plan => plan.status === 'published') ? <div className="evac-route-note"><strong>{dashboard.plans.find(plan => plan.status === 'published')?.versionCode}</strong><span>มีผล {formatDate(dashboard.plans.find(plan => plan.status === 'published')?.effectiveDate)} · จุดรายงานตัวเชื่อมอยู่ในแผน</span></div> : <div className="evac-callout" data-tone="danger"><strong>ยังไม่มีแผนอพยพที่เผยแพร่</strong><span>สร้างแบบร่าง เลือก map release จุดรวมพล งานทบทวน และกำหนดทางออกหลัก/สำรองให้ครบก่อนส่งอนุมัติ</span><div className="evac-actions"><Button size="lg" icon="plus" onClick={onNewPlan}>สร้างแบบร่าง</Button><Button variant="secondary" size="lg" onClick={() => onTab('assembly')}>ตรวจจุดรวมพล</Button></div></div>}
      </article>
      <article className="evac-card"><div className="evac-card-head"><div><h2>รอบซ้อมล่าสุด</h2><p>การซ้อมต้องมีผู้เข้าร่วม การนับคน ผลประเมิน และหลักฐานที่เชื่อมกับงาน</p></div>{latestCycle ? <Status value={latestCycle.status} labels={CYCLE_STATUS_LABELS} /> : null}</div>
        {latestCycle ? <><strong>{latestCycle.ownerText}</strong><span className="evac-muted">ครบกำหนด {formatDate(latestCycle.dueDate)} · {latestCycle.sessions.length} ครั้ง</span><Button variant="secondary" size="lg" onClick={() => onTab('drills')}>เปิดรายละเอียดรอบซ้อม</Button></> : <div className="evac-empty"><p>ยังไม่มีรอบซ้อมประจำปี สร้างรอบใหม่ในแท็บการซ้อมเพื่อเชื่อมกับงาน CBH-ST-17</p></div>}
      </article>
    </div>
    <article className="evac-card"><div className="evac-card-head"><div><h2>สิ่งที่ต้องทำต่อ</h2><p>รายการนี้คัดจากสถานะแผน งาน และหลักฐานที่ระบบอ่านได้จริง</p></div><Button variant="secondary" size="lg" onClick={() => onTab('tasks')}>ดูงานและหลักฐาน</Button></div>
      <div className="evac-grid-3"><div className="evac-callout"><strong>{dashboard.plans.filter(plan => plan.status === 'draft' || plan.status === 'in_review').length} แผนรอดำเนินการ</strong><span>ตรวจ version และสถานะอนุมัติ</span></div><div className="evac-callout"><strong>{dashboard.assemblyPoints.filter(point => point.lifecycleStatus === 'active' && !point.verified).length} จุดรอยืนยัน</strong><span>ต้องมี GPS และรูปหลักฐานก่อน publish</span></div><div className="evac-callout" data-tone={unresolvedEvidence ? 'danger' : undefined}><strong>{unresolvedEvidence} ข้อกำหนดหลักฐานค้าง</strong><span>เปิดงานที่เชื่อมไว้เพื่อแนบ/ตรวจหลักฐาน</span></div></div>
    </article>
    {dashboard.plans.length ? <article className="evac-card"><div className="evac-card-head"><h2>แผนทั้งหมด</h2><span className="evac-muted">คลิกเพื่อเปิดตัวแก้ไข</span></div><div className="evac-table-wrap"><table className="evac-table"><thead><tr><th>Version</th><th>สถานะ</th><th>Map release</th><th>มีผล</th><th>ทางออก/จุดรวมพล</th></tr></thead><tbody>{dashboard.plans.map(plan => <tr key={plan.id}><td><button type="button" className="evac-link" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit' }} onClick={() => onSelectPlan(plan.id)}>{plan.versionCode}</button><div className="evac-muted">{plan.planCode}</div></td><td><Status value={plan.status} labels={PLAN_STATUS_LABELS} /></td><td>{plan.mapReleaseVersion ?? '—'}</td><td>{formatDate(plan.effectiveDate)}</td><td>{plan.assignments.length} รายการ · {plan.reviewTaskLink ? 'เชื่อมงานแล้ว' : 'ยังไม่เชื่อมงาน'}</td></tr>)}</tbody></table></div></article> : null}
  </section>
}

function PlanPanel({ dashboard, canEdit, canManage, busy, selectedPlan, planEditorId, planDraft, setPlanEditorId, setPlanDraft, onNew, onSelect, onSave, onTransition }: {
  dashboard: EvacuationDashboardDTO
  canEdit: boolean
  canManage: boolean
  busy: boolean
  selectedPlan: EvacuationPlanDTO | null
  planEditorId: string | 'new'
  planDraft: PlanDraft
  setPlanEditorId: (id: string | 'new') => void
  setPlanDraft: React.Dispatch<React.SetStateAction<PlanDraft>>
  onNew: () => void
  onSelect: (id: string) => void
  onSave: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onTransition: (action: 'submit' | 'approve' | 'publish' | 'retire') => Promise<void>
}) {
  const editable = canEdit && selectedPlan?.status !== 'published'
  const exits = dashboard.map.accessPoints.filter(point => point.kind === 'exit')
  const points = dashboard.assemblyPoints.filter(point => point.lifecycleStatus === 'active')
  const routes = dashboard.map.routes.filter(route => route.kind === 'evacuation')
  const updateDraft = (patch: Partial<PlanDraft>) => setPlanDraft(current => ({ ...current, ...patch }))
  const updateAssignment = (index: number, patch: Partial<AssignmentDraft>) => setPlanDraft(current => ({ ...current, assignments: current.assignments.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) }))
  const routeOptions = (assignment: AssignmentDraft) => {
    const exact = routes.filter(route => route.variant === assignment.routeVariant && route.fromStationCode === assignment.scopeCode)
    return exact.length ? exact : routes.filter(route => route.variant === assignment.routeVariant)
  }
  return <section className="evac-panel" id="evac-panel-plan" role="tabpanel" aria-label="แผนและเส้นทาง">
    <div className="evac-toolbar"><div><h2 style={{ margin: 0, fontSize: 19 }}>ทะเบียนแผนอพยพและเส้นทาง</h2><p className="evac-help" style={{ margin: '4px 0 0' }}>แต่ละพื้นที่ต้องมี route หลัก/สำรอง และจุดปลายทางที่ยืนยันตำแหน่งแล้วก่อนเผยแพร่</p></div>{canEdit ? <Button size="lg" icon="plus" onClick={onNew}>สร้างฉบับใหม่</Button> : null}</div>
    <div className="evac-grid-2">
      <article className="evac-card"><div className="evac-card-head"><h2>ฉบับที่มีในระบบ</h2><span className="evac-muted">{dashboard.plans.length} version</span></div><div className="evac-list">{dashboard.plans.map(plan => <button type="button" className="evac-list-item" data-selected={planEditorId === plan.id} key={plan.id} onClick={() => onSelect(plan.id)}><span className="evac-card-head"><strong>{plan.versionCode}</strong><Status value={plan.status} labels={PLAN_STATUS_LABELS} /></span><small>{plan.planCode} · map {plan.mapReleaseVersion ?? 'ไม่พบ release'} · {plan.assignments.length} เส้นทาง</small></button>)}{!dashboard.plans.length ? <div className="evac-empty"><p>ยังไม่มีแผน กด “สร้างฉบับใหม่” เพื่อเริ่มแบบร่างที่เชื่อมกับงานทบทวน</p></div> : null}</div></article>
      <form className="evac-form" onSubmit={onSave} aria-label="แบบฟอร์มแผนอพยพ">
        <div className="evac-card-head"><div><h2>{selectedPlan ? `แก้ไข ${selectedPlan.versionCode}` : 'สร้างแผนฉบับใหม่'}</h2><p className="evac-help">บันทึกเป็นแบบร่างก่อน แล้วส่งทบทวน/อนุมัติ/เผยแพร่ตามลำดับ</p></div>{selectedPlan ? <Status value={selectedPlan.status} labels={PLAN_STATUS_LABELS} /> : <Status value="draft" labels={PLAN_STATUS_LABELS} />}</div>
        <div className="evac-form-grid"><label>รหัสแผน<input disabled={!editable} value={planDraft.planCode} onChange={event => updateDraft({ planCode: event.target.value })} /></label><label>Version<input disabled={!editable} value={planDraft.versionCode} onChange={event => updateDraft({ versionCode: event.target.value })} /></label><label>Map release<select disabled={!editable} value={planDraft.mapReleaseId} onChange={event => updateDraft({ mapReleaseId: event.target.value })}><option value="">เลือก release ที่เผยแพร่แล้ว</option>{dashboard.releases.map(release => <option key={release.id} value={release.id} disabled={release.status !== 'published'}>{release.versionCode} · {release.status === 'published' ? 'เผยแพร่แล้ว' : release.status}</option>)}</select></label><label>งานทบทวน/เชื่อมหลักฐาน<select disabled={!editable} value={planDraft.reviewTaskKey} onChange={event => updateDraft({ reviewTaskKey: event.target.value })}><option value="">เลือกงานที่ใช้กับแผน</option>{dashboard.tasks.filter(task => PLAN_TASK_KEYS.has(task.sourceKey ?? '')).map(task => <option key={task.key} value={task.key} disabled={!taskReference(task)}>{taskLabel(task)}{task.instanceId ? '' : ' · ยังไม่ materialize'}</option>)}</select></label><label>วันมีผล<input disabled={!editable} type="date" value={planDraft.effectiveDate} onChange={event => updateDraft({ effectiveDate: event.target.value })} /></label><label>วันทบทวนถัดไป<input disabled={!editable} type="date" value={planDraft.reviewDueDate} onChange={event => updateDraft({ reviewDueDate: event.target.value })} /></label><label>จุดรายงานตัว<select disabled={!editable} value={planDraft.reportPointId} onChange={event => updateDraft({ reportPointId: event.target.value })}><option value="">เลือกจุดรายงานตัว</option>{points.map(point => <option key={point.id} value={point.id}>{point.nameTh} · {point.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}</option>)}</select></label><label>ผู้รับผิดชอบนับคน/รายงานตัว<input disabled={!editable} value={planDraft.headcountResponsible} onChange={event => updateDraft({ headcountResponsible: event.target.value })} placeholder="ชื่อหรือหน่วยงาน" /></label></div>
        <label className="evac-form">หมายเหตุ<textarea disabled={!editable} value={planDraft.notes} onChange={event => updateDraft({ notes: event.target.value })} /></label>
        <div className="evac-inline"><h3>เส้นทางตามพื้นที่</h3>{editable ? <Button variant="secondary" size="lg" icon="plus" onClick={() => setPlanDraft(current => ({ ...current, assignments: [...current.assignments, { scopeType: 'space', scopeCode: '', exitCode: '', routeVariant: 'primary', routeCode: '', assemblyPointId: points[0]?.id ?? '', postExitInstructionTh: 'ไปยังจุดรวมพล ห้ามย้อนกลับเข้าอาคาร และรอการนับคน', responsibleText: '' }] }))}>เพิ่มพื้นที่</Button> : null}</div>
        <div className="evac-panel">{planDraft.assignments.map((assignment, index) => <div className="evac-assignment" key={`${assignment.scopeCode}-${assignment.routeVariant}-${index}`}><div className="evac-assignment-head"><strong>{assignment.scopeCode || `พื้นที่ ${index + 1}`} · {assignment.routeVariant === 'primary' ? 'ทางออกหลัก' : 'ทางออกสำรอง'}</strong>{editable ? <Button variant="ghost" size="sm" icon="trash" title="ลบรายการ" onClick={() => setPlanDraft(current => ({ ...current, assignments: current.assignments.filter((_, itemIndex) => itemIndex !== index) }))}>ลบ</Button> : null}</div><div className="evac-assignment-grid"><label>ประเภทพื้นที่<select disabled={!editable} value={assignment.scopeType} onChange={event => updateAssignment(index, { scopeType: event.target.value as AssignmentDraft['scopeType'] })}><option value="station">สถานี</option><option value="space">ห้อง/พื้นที่</option><option value="zone">โซน</option></select></label><label>รหัสพื้นที่<input disabled={!editable} value={assignment.scopeCode} onChange={event => updateAssignment(index, { scopeCode: event.target.value })} placeholder="เช่น office" /></label><label>รูปแบบเส้นทาง<select disabled={!editable} value={assignment.routeVariant} onChange={event => { const routeVariant = event.target.value as AssignmentDraft['routeVariant']; updateAssignment(index, { routeVariant, routeCode: routes.find(route => route.variant === routeVariant && route.fromStationCode === assignment.scopeCode)?.code ?? '' }) }}><option value="primary">หลัก</option><option value="alternate">สำรอง</option></select></label><label>ทางออก<select disabled={!editable} value={assignment.exitCode} onChange={event => updateAssignment(index, { exitCode: event.target.value })}><option value="">เลือกทางออก</option>{exits.map(exit => <option key={exit.code} value={exit.code}>{exit.code} · {exit.nameTh} · {exit.status === 'permanently_locked' ? 'ล็อกถาวร' : 'ใช้งาน'}</option>)}</select></label><label>Route preset<select disabled={!editable} value={assignment.routeCode} onChange={event => updateAssignment(index, { routeCode: event.target.value })}><option value="">เลือก route preset</option>{assignment.routeCode && !routeOptions(assignment).some(route => route.code === assignment.routeCode) ? <option value={assignment.routeCode}>{assignment.routeCode} · route เดิม</option> : null}{routeOptions(assignment).map(route => <option key={route.code} value={route.code}>{route.code} · {route.destinationCode}</option>)}</select></label><label>จุดรวมพล/จุดปลายทาง<select disabled={!editable} value={assignment.assemblyPointId} onChange={event => updateAssignment(index, { assemblyPointId: event.target.value })}><option value="">เลือกจุด</option>{points.map(point => <option key={point.id} value={point.id}>{point.nameTh} · {point.verified ? 'GPS ยืนยันแล้ว' : 'รอยืนยัน'}</option>)}</select></label></div><div className="evac-form-grid"><label>คำสั่งหลังออกจากอาคาร<textarea disabled={!editable} value={assignment.postExitInstructionTh} onChange={event => updateAssignment(index, { postExitInstructionTh: event.target.value })} /></label><label>ผู้รับผิดชอบพื้นที่<textarea disabled={!editable} value={assignment.responsibleText} onChange={event => updateAssignment(index, { responsibleText: event.target.value })} /></label></div></div>)}</div>
        {editable ? <div className="evac-actions"><Button type="submit" size="lg" icon="check" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกแบบร่าง'}</Button></div> : null}
        {selectedPlan ? <div className="evac-actions"><PlanTransitionActions plan={selectedPlan} canEdit={canEdit} canManage={canManage} busy={busy} onTransition={onTransition} /></div> : null}
      </form>
    </div>
  </section>
}

function PlanTransitionActions({ plan, canEdit, canManage, busy, onTransition }: { plan: EvacuationPlanDTO; canEdit: boolean; canManage: boolean; busy: boolean; onTransition: (action: 'submit' | 'approve' | 'publish' | 'retire') => Promise<void> }) {
  return <>{canEdit && plan.status === 'draft' ? <Button variant="secondary" size="lg" icon="arrowRight" disabled={busy} onClick={() => void onTransition('submit')}>ส่งทบทวน</Button> : null}{canManage && plan.status === 'in_review' ? <Button size="lg" icon="check" disabled={busy} onClick={() => void onTransition('approve')}>อนุมัติแผน</Button> : null}{canManage && plan.status === 'approved' ? <Button size="lg" icon="globe" disabled={busy} onClick={() => void onTransition('publish')}>เผยแพร่แผน</Button> : null}{canManage && (plan.status === 'approved' || plan.status === 'published') ? <Button variant="danger" size="lg" icon="lock" disabled={busy} onClick={() => void onTransition('retire')}>เลิกใช้ version</Button> : null}</>
}

function AssemblyPanel({ dashboard, canEdit, canManage, busy, selectedPoint, pointDraft, setPointDraft, setPointId, pointFile, setPointFile, pointNote, setPointNote, pointAccuracy, setPointAccuracy, onNew, onEdit, onSave, onVerify, onRetire }: {
  dashboard: EvacuationDashboardDTO
  canEdit: boolean
  canManage: boolean
  busy: boolean
  selectedPoint: AssemblyPointDTO | null
  pointDraft: PointDraft | null
  setPointDraft: React.Dispatch<React.SetStateAction<PointDraft | null>>
  setPointId: (id: string | null) => void
  pointFile: File | null
  setPointFile: (file: File | null) => void
  pointNote: string
  setPointNote: (value: string) => void
  pointAccuracy: string
  setPointAccuracy: (value: string) => void
  onNew: (pointType: 'assembly' | 'safe') => void
  onEdit: (point: AssemblyPointDTO) => void
  onSave: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onVerify: () => Promise<void>
  onRetire: () => Promise<void>
}) {
  const updateDraft = (patch: Partial<PointDraft>) => setPointDraft(current => current ? { ...current, ...patch } : current)
  return <section className="evac-panel" id="evac-panel-assembly" role="tabpanel" aria-label="จุดรวมพล">
    <div className="evac-toolbar"><div><h2 style={{ margin: 0, fontSize: 19 }}>ทะเบียนจุดรวมพลและจุดปลอดภัย</h2><p className="evac-help" style={{ margin: '4px 0 0' }}>จุดที่ใช้ publish ต้องมีพิกัด GPS, การยืนยันหน้างาน และเชื่อมทางออกที่เกี่ยวข้อง</p></div>{canEdit ? <div className="evac-actions"><Button size="lg" icon="plus" onClick={() => onNew('assembly')}>เพิ่มจุดรวมพล</Button><Button variant="secondary" size="lg" icon="plus" onClick={() => onNew('safe')}>เพิ่มจุดปลอดภัย</Button></div> : null}</div>
    <div className="evac-point-grid"><article className="evac-card"><div className="evac-card-head"><h2>จุดที่ใช้งาน</h2><span className="evac-muted">{dashboard.assemblyPoints.length} จุด</span></div><div className="evac-list">{dashboard.assemblyPoints.map(point => <button type="button" key={point.id} className="evac-list-item" data-selected={selectedPoint?.id === point.id} onClick={() => { setPointId(point.id); setPointDraft(null) }}><span className="evac-card-head"><strong>{point.nameTh}</strong><Badge color={point.pointType === 'safe' ? 'green' : 'blue'}>{point.pointType === 'safe' ? 'จุดปลอดภัย' : 'จุดรวมพล'}</Badge></span><small>{point.code} · {point.verified ? 'ยืนยัน GPS แล้ว' : 'รอยืนยัน'} · {point.exitCodes.join(', ') || 'ยังไม่เชื่อมทางออก'}</small></button>)}{!dashboard.assemblyPoints.length ? <div className="evac-empty"><p>ยังไม่มีจุด เพิ่มจุดรวมพลอย่างน้อยหนึ่งจุดเพื่อเริ่มทำแผน</p></div> : null}</div></article>
      {pointDraft ? <form className="evac-form" onSubmit={onSave}><div className="evac-card-head"><div><h2>{pointDraft.id ? 'แก้ไขจุด' : 'เพิ่มจุด'}</h2><p className="evac-help">การแก้พิกัดหรือทางออกจะทำให้สถานะกลับเป็นรอยืนยันโดยอัตโนมัติ</p></div></div><div className="evac-form-grid"><label>ประเภทจุด<select value={pointDraft.pointType} onChange={event => updateDraft({ pointType: event.target.value as PointDraft['pointType'] })}><option value="assembly">จุดรวมพล</option><option value="safe">จุดปลอดภัย</option></select></label><label>รหัสจุด<input disabled={Boolean(pointDraft.id)} value={pointDraft.code} onChange={event => updateDraft({ code: event.target.value })} placeholder="เช่น assembly-main" /></label><label>ชื่อจุด<input value={pointDraft.nameTh} onChange={event => updateDraft({ nameTh: event.target.value })} /></label><label>Latitude<input type="number" step="0.000001" value={pointDraft.latitude} onChange={event => updateDraft({ latitude: event.target.value })} /></label><label>Longitude<input type="number" step="0.000001" value={pointDraft.longitude} onChange={event => updateDraft({ longitude: event.target.value })} /></label></div><div className="evac-actions"><Button variant="secondary" size="lg" icon="globe" onClick={() => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition(position => setPointDraft(current => current ? { ...current, latitude: position.coords.latitude.toFixed(6), longitude: position.coords.longitude.toFixed(6) } : current), cause => setPointNote(`อ่าน GPS ไม่สำเร็จ: ${cause.message}`), { enableHighAccuracy: true, timeout: 15000 }) }}>ใช้พิกัดอุปกรณ์</Button></div><GoogleMapEmbed latitude={pointDraft.latitude ? Number(pointDraft.latitude) : null} longitude={pointDraft.longitude ? Number(pointDraft.longitude) : null} nameTh={pointDraft.nameTh} /><label>รายละเอียด/จุดสังเกต<textarea value={pointDraft.detailTh} onChange={event => updateDraft({ detailTh: event.target.value })} /></label><fieldset className="evac-form"><legend>ทางออกที่เชื่อม</legend><div className="evac-checks">{EXIT_CODES.map(exitCode => <label key={exitCode}><input type="checkbox" checked={pointDraft.exitCodes.includes(exitCode)} onChange={event => updateDraft({ exitCodes: event.target.checked ? [...pointDraft.exitCodes, exitCode] : pointDraft.exitCodes.filter(code => code !== exitCode) })} />{exitCode.replace('exit-', '').toUpperCase()}</label>)}</div></fieldset><div className="evac-actions"><Button variant="secondary" size="lg" onClick={() => setPointDraft(null)}>ยกเลิก</Button><Button type="submit" size="lg" icon="check" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกจุด'}</Button></div></form> : selectedPoint ? <PointDetail point={selectedPoint} canEdit={canEdit} canManage={canManage} busy={busy} pointFile={pointFile} setPointFile={setPointFile} pointNote={pointNote} setPointNote={setPointNote} pointAccuracy={pointAccuracy} setPointAccuracy={setPointAccuracy} onEdit={() => onEdit(selectedPoint)} onVerify={onVerify} onRetire={onRetire} /> : <div className="evac-empty"><p>เลือกจุดจากรายการ หรือเพิ่มจุดใหม่เพื่อดูพิกัดและหลักฐานการยืนยัน</p></div>}
    </div>
  </section>
}

function PointDetail({ point, canEdit, canManage, busy, pointFile, setPointFile, pointNote, setPointNote, pointAccuracy, setPointAccuracy, onEdit, onVerify, onRetire }: { point: AssemblyPointDTO; canEdit: boolean; canManage: boolean; busy: boolean; pointFile: File | null; setPointFile: (file: File | null) => void; pointNote: string; setPointNote: (value: string) => void; pointAccuracy: string; setPointAccuracy: (value: string) => void; onEdit: () => void; onVerify: () => Promise<void>; onRetire: () => Promise<void> }) {
  const coordinates = point.latitude != null && point.longitude != null ? `${point.latitude},${point.longitude}` : null
  return <article className="evac-point-detail evac-card"><div className="evac-card-head"><div><h2>{point.nameTh}</h2><p>{point.detailTh || 'ยังไม่มีจุดสังเกตเพิ่มเติม'}</p></div><Status value={point.verified ? 'published' : 'draft'} labels={{ published: 'ยืนยัน GPS แล้ว', draft: 'รอยืนยันหน้างาน' }} /></div><div className="evac-inline"><span className="evac-muted">{point.code} · {point.pointType === 'safe' ? 'จุดปลอดภัย' : 'จุดรวมพล'} · ทางออก {point.exitCodes.join(', ') || 'ยังไม่เชื่อม'}</span>{canEdit ? <Button variant="secondary" size="lg" icon="edit" onClick={onEdit}>แก้ข้อมูล</Button> : null}</div>{coordinates ? <><GoogleMapEmbed latitude={point.latitude} longitude={point.longitude} nameTh={point.nameTh} /><div className="evac-actions"><a className="evac-link" href={`https://www.google.com/maps?q=${coordinates}`} target="_blank" rel="noreferrer">เปิด Google Maps</a><span className="evac-muted">{coordinates}</span></div></> : <div className="evac-callout" data-tone="danger"><strong>ยังไม่มีพิกัด GPS</strong><span>กรอกพิกัดจากอุปกรณ์หรือแผนที่ก่อนส่งตรวจ</span></div>}{point.latestVerification?.photoUrl ? <><h3>หลักฐานล่าสุด</h3><img className="evac-photo" src={point.latestVerification.photoUrl} alt={`หลักฐานการยืนยัน ${point.nameTh}`} /></> : null}{canEdit ? <div className="evac-form"><SafetyPhotoPicker label="รูปยืนยันหน้างาน" file={pointFile} disabled={busy} onChange={setPointFile} /><div className="evac-form-grid"><label>ความแม่นยำ GPS (เมตร)<input type="number" min="0" value={pointAccuracy} onChange={event => setPointAccuracy(event.target.value)} /></label><label>หมายเหตุ<textarea value={pointNote} onChange={event => setPointNote(event.target.value)} /></label></div><Button size="lg" icon="shieldCheck" disabled={busy || !pointFile || !coordinates || !point.exitCodes.length} onClick={() => void onVerify()}>ยืนยันจากหลักฐานหน้างาน</Button><span className="evac-help">หลังยืนยันแล้ว แผนจึงจะผ่าน publish gate ได้</span></div> : null}{canManage ? <Button variant="danger" size="lg" icon="lock" disabled={busy} onClick={() => void onRetire()}>เลิกใช้จุดนี้</Button> : null}</article>
}

function DrillsPanel({ dashboard, canEdit, busy, selectedCycle, selectedSession, cycleEditorId, cycleDraft, sessionDraft, setCycleEditorId, setCycleDraft, setSessionEditorId, setSessionDraft, onSaveCycle, onSaveSession, onLinkEvidence }: {
  dashboard: EvacuationDashboardDTO
  canEdit: boolean
  busy: boolean
  selectedCycle: EvacuationDrillCycleDTO | null
  selectedSession: EvacuationDrillSessionDTO | null
  cycleEditorId: string | 'new'
  cycleDraft: CycleDraft
  sessionDraft: SessionDraft
  setCycleEditorId: (id: string | 'new') => void
  setCycleDraft: React.Dispatch<React.SetStateAction<CycleDraft>>
  setSessionEditorId: (id: string | 'new') => void
  setSessionDraft: React.Dispatch<React.SetStateAction<SessionDraft>>
  onSaveCycle: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onSaveSession: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onLinkEvidence: (session: EvacuationDrillSessionDTO, attachmentId: string, role: typeof EVIDENCE_ROLES[number]) => Promise<void>
}) {
  const drillTasks = dashboard.tasks.filter(task => DRILL_TASK_KEYS.has(task.sourceKey ?? ''))
  const approvedPlans = dashboard.plans.filter(plan => ['approved', 'published'].includes(plan.status))
  const updateCycle = (patch: Partial<CycleDraft>) => setCycleDraft(current => ({ ...current, ...patch }))
  const updateSession = (patch: Partial<SessionDraft>) => setSessionDraft(current => ({ ...current, ...patch }))
  function startNewSession() {
    setSessionEditorId('new')
    setSessionDraft(sessionToDraft(selectedCycle, null, dashboard.assemblyPoints))
  }
  function selectSession(session: EvacuationDrillSessionDTO) {
    setSessionEditorId(session.id)
    setSessionDraft(sessionToDraft(selectedCycle, session, dashboard.assemblyPoints))
  }
  return <section className="evac-panel" id="evac-panel-drills" role="tabpanel" aria-label="การซ้อมประจำปี">
    <div className="evac-toolbar"><div><h2 style={{ margin: 0, fontSize: 19 }}>แผนการซ้อมอพยพประจำปี</h2><p className="evac-help" style={{ margin: '4px 0 0' }}>หนึ่งรอบซ้อมเชื่อมกับงานความปลอดภัยหนึ่งงาน และเก็บผลการซ้อม/หลักฐานไว้ตรวจสอบย้อนหลัง</p></div>{canEdit ? <Button size="lg" icon="plus" onClick={() => { setCycleEditorId('new'); setCycleDraft(cycleToDraft(null, dashboard)) }}>สร้างรอบซ้อม</Button> : null}</div>
    <div className="evac-grid-2">
      <article className="evac-card"><div className="evac-card-head"><h2>รอบซ้อม</h2><span className="evac-muted">{dashboard.cycles.length} รอบ</span></div><div className="evac-list">{dashboard.cycles.map(cycle => <button type="button" className="evac-list-item" data-selected={cycleEditorId === cycle.id} key={cycle.id} onClick={() => setCycleEditorId(cycle.id)}><span className="evac-card-head"><strong>FY {cycle.fiscalYear}</strong><Status value={cycle.status} labels={CYCLE_STATUS_LABELS} /></span><small>{cycle.ownerText} · ครบกำหนด {formatDate(cycle.dueDate)} · {cycle.sessions.length} ครั้ง</small></button>)}{!dashboard.cycles.length ? <div className="evac-empty"><p>ยังไม่มีรอบซ้อม เลือกงาน CBH-ST-17/21 และแผนที่อนุมัติแล้วเพื่อเริ่ม</p></div> : null}</div></article>
      <form className="evac-form" onSubmit={onSaveCycle}><div className="evac-card-head"><div><h2>{selectedCycle ? `รอบซ้อม FY ${selectedCycle.fiscalYear}` : 'สร้างรอบซ้อมใหม่'}</h2><p className="evac-help">การสร้างรอบจะสร้าง link ไปยังงานในโมดูลงานและหลักฐานทันที</p></div>{selectedCycle ? <Status value={selectedCycle.status} labels={CYCLE_STATUS_LABELS} /> : null}</div><div className="evac-form-grid"><label>ปีงบประมาณ<input type="number" min="2500" max="2700" disabled={!canEdit || Boolean(selectedCycle)} value={cycleDraft.fiscalYear} onChange={event => updateCycle({ fiscalYear: event.target.value })} /></label><label>แผนที่ใช้<select disabled={!canEdit || Boolean(selectedCycle)} value={cycleDraft.planVersionId} onChange={event => updateCycle({ planVersionId: event.target.value })}><option value="">เลือกแผนที่อนุมัติแล้ว</option>{approvedPlans.map(plan => <option key={plan.id} value={plan.id}>{plan.versionCode} · {PLAN_STATUS_LABELS[plan.status]}</option>)}</select></label><label>งานซ้อม/งานที่เชื่อม<select disabled={!canEdit || Boolean(selectedCycle)} value={cycleDraft.taskKey} onChange={event => updateCycle({ taskKey: event.target.value })}><option value="">เลือกงานซ้อมประจำปี</option>{drillTasks.map(task => <option key={task.key} value={task.key} disabled={!taskReference(task)}>{taskLabel(task)}{task.instanceId ? '' : ' · ยังไม่ materialize'}</option>)}</select></label><label>ผู้รับผิดชอบ<input disabled={!canEdit || Boolean(selectedCycle)} value={cycleDraft.ownerText} onChange={event => updateCycle({ ownerText: event.target.value })} /></label><label>กำหนดเสร็จ<input disabled={!canEdit || Boolean(selectedCycle)} type="date" value={cycleDraft.dueDate} onChange={event => updateCycle({ dueDate: event.target.value })} /></label></div><label>หมายเหตุ<textarea disabled={!canEdit || Boolean(selectedCycle)} value={cycleDraft.notes} onChange={event => updateCycle({ notes: event.target.value })} /></label>{canEdit && !selectedCycle ? <Button type="submit" size="lg" icon="check" disabled={busy}>{busy ? 'กำลังสร้าง…' : 'สร้างรอบและเชื่อมงาน'}</Button> : null}</form>
    </div>
    {selectedCycle ? <><article className="evac-card"><div className="evac-card-head"><div><h2>ผลการซ้อมในรอบนี้</h2><p>เลือกผลเดิมเพื่อแก้ไข หรือเปิดรายการใหม่เมื่อมีการซ้อมจริง</p></div>{canEdit ? <Button size="lg" icon="plus" onClick={startNewSession}>บันทึกผลการซ้อม</Button> : null}</div><div className="evac-table-wrap"><table className="evac-table"><thead><tr><th>สถานการณ์</th><th>เวลา</th><th>ผู้เข้าร่วม/นับคน</th><th>ผลประเมิน</th><th>สถานะ</th></tr></thead><tbody>{selectedCycle.sessions.map(session => <tr key={session.id}><td><button type="button" className="evac-link" style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', font: 'inherit', textAlign: 'left' }} onClick={() => selectSession(session)}>{session.scenario}</button><div className="evac-muted">{session.offHours ? 'นอกเวลาราชการ' : 'ในเวลาราชการ'}</div></td><td>{formatDateTime(session.startedAt)}<br />{formatDuration(session.durationSeconds)}</td><td>{session.actualParticipants}/{session.expectedParticipants} คน<br />นับครบ {session.headcountComplete == null ? 'ไม่ระบุ' : session.headcountComplete ? 'ใช่' : 'ไม่ครบ'}</td><td>{session.compliancePercent == null ? '—' : `${session.compliancePercent}%`}<br />{session.injuredCount ? `บาดเจ็บ ${session.injuredCount}` : 'ไม่มีรายงานบาดเจ็บ'}</td><td><Status value={session.status} labels={SESSION_STATUS_LABELS} /><div className="evac-muted">หลักฐาน {session.evidence.length} รายการ</div></td></tr>)}</tbody></table>{!selectedCycle.sessions.length ? <div className="evac-empty"><p>ยังไม่มีผลการซ้อมในรอบนี้</p></div> : null}</div></article><div className="evac-grid-2"><form className="evac-form" onSubmit={onSaveSession}><div className="evac-card-head"><div><h2>{selectedSession ? 'แก้ไขผลการซ้อม' : 'บันทึกผลการซ้อม'}</h2><p className="evac-help">บันทึกเวลา ผู้เข้าร่วม การนับคน ผลประเมิน และ deviation ให้ครบ</p></div>{selectedSession ? <Status value={selectedSession.status} labels={SESSION_STATUS_LABELS} /> : null}</div><div className="evac-form-grid"><label>รอบซ้อม<select disabled={!canEdit || Boolean(selectedSession)} value={sessionDraft.cycleId} onChange={event => updateSession({ cycleId: event.target.value })}><option value="">เลือกรอบ</option>{dashboard.cycles.map(cycle => <option key={cycle.id} value={cycle.id}>FY {cycle.fiscalYear} · {cycle.ownerText}</option>)}</select></label><label>สถานการณ์<input disabled={!canEdit} value={sessionDraft.scenario} onChange={event => updateSession({ scenario: event.target.value })} /></label><label>เริ่มซ้อม<input disabled={!canEdit} type="datetime-local" value={sessionDraft.startedAt} onChange={event => updateSession({ startedAt: event.target.value })} /></label><label>สิ้นสุด<input disabled={!canEdit} type="datetime-local" value={sessionDraft.endedAt} onChange={event => updateSession({ endedAt: event.target.value })} /></label><label>ผู้เข้าร่วมคาดหมาย<input disabled={!canEdit} type="number" min="0" value={sessionDraft.expectedParticipants} onChange={event => updateSession({ expectedParticipants: event.target.value })} /></label><label>ผู้เข้าร่วมจริง<input disabled={!canEdit} type="number" min="0" value={sessionDraft.actualParticipants} onChange={event => updateSession({ actualParticipants: event.target.value })} /></label><label>จำนวนที่ต้องนับ<input disabled={!canEdit} type="number" min="0" value={sessionDraft.expectedHeadcount} onChange={event => updateSession({ expectedHeadcount: event.target.value })} /></label><label>นับได้<input disabled={!canEdit} type="number" min="0" value={sessionDraft.checkedHeadcount} onChange={event => updateSession({ checkedHeadcount: event.target.value })} /></label><label>สูญหาย/ตามไม่พบ<input disabled={!canEdit} type="number" min="0" value={sessionDraft.missingHeadcount} onChange={event => updateSession({ missingHeadcount: event.target.value })} /></label><label>บาดเจ็บ<input disabled={!canEdit} type="number" min="0" value={sessionDraft.injuredCount} onChange={event => updateSession({ injuredCount: event.target.value })} /></label><label>จุดรายงานตัว<select disabled={!canEdit} value={sessionDraft.reportPointId} onChange={event => updateSession({ reportPointId: event.target.value })}><option value="">ไม่ระบุ</option>{dashboard.assemblyPoints.map(point => <option key={point.id} value={point.id}>{point.nameTh}</option>)}</select></label><label>ความสอดคล้อง (%)<input disabled={!canEdit} type="number" min="0" max="100" value={sessionDraft.compliancePercent} onChange={event => updateSession({ compliancePercent: event.target.value })} /></label></div><div className="evac-form-grid"><label>พื้นที่ที่ซ้อม<input disabled={!canEdit} value={sessionDraft.scopeCodes} onChange={event => updateSession({ scopeCodes: event.target.value })} placeholder="office, central-corridor" /></label><label>Route codes<input disabled={!canEdit} value={sessionDraft.routeCodes} onChange={event => updateSession({ routeCodes: event.target.value })} placeholder="evacuation-office-3c" /></label></div><label>ผู้สังเกตการณ์<input disabled={!canEdit} value={sessionDraft.observerText} onChange={event => updateSession({ observerText: event.target.value })} /></label><label>ผลประเมิน<textarea disabled={!canEdit} value={sessionDraft.evaluation} onChange={event => updateSession({ evaluation: event.target.value })} /></label><label>ข้อเบี่ยงเบน/การแก้ไข<textarea disabled={!canEdit} value={sessionDraft.deviationText} onChange={event => updateSession({ deviationText: event.target.value })} /></label><div className="evac-inline"><label style={{ display: 'flex', alignItems: 'center', flexDirection: 'row', minHeight: 44, gap: 8 }}><input type="checkbox" disabled={!canEdit} checked={sessionDraft.offHours} onChange={event => updateSession({ offHours: event.target.checked })} style={{ width: 18, minHeight: 18 }} /> ซ้อมนอกเวลาราชการ</label><label>สถานะ<select disabled={!canEdit} value={sessionDraft.status} onChange={event => updateSession({ status: event.target.value as SessionDraft['status'] })}><option value="planned">นัดหมาย</option><option value="completed">บันทึกผลแล้ว</option></select></label></div>{canEdit ? <Button type="submit" size="lg" icon="check" disabled={busy}>{busy ? 'กำลังบันทึก…' : selectedSession ? 'บันทึกการแก้ไข' : 'บันทึกผลการซ้อม'}</Button> : null}</form><EvidenceLinkPanel cycle={selectedCycle} session={selectedSession} canEdit={canEdit} busy={busy} onLink={onLinkEvidence} /></div></> : <div className="evac-callout" data-tone="danger"><strong>เลือกหรือสร้างรอบซ้อมก่อน</strong><span>เมื่อมีรอบซ้อมแล้วจึงจะบันทึกผลและเชื่อมหลักฐานที่แนบในงานได้</span></div>}
  </section>
}

function EvidenceLinkPanel({ cycle, session, canEdit, busy, onLink }: { cycle: EvacuationDrillCycleDTO; session: EvacuationDrillSessionDTO | null; canEdit: boolean; busy: boolean; onLink: (session: EvacuationDrillSessionDTO, attachmentId: string, role: typeof EVIDENCE_ROLES[number]) => Promise<void> }) {
  const [roles, setRoles] = useState<Record<string, typeof EVIDENCE_ROLES[number]>>({})
  const attachments = cycle.task?.attachments ?? []
  return <article className="evac-card"><div className="evac-card-head"><div><h2>หลักฐานที่เชื่อมกับผลซ้อม</h2><p>ไฟล์มาจากงานที่เชื่อมไว้ ไม่สร้างสำเนาใหม่ในโมดูลนี้</p></div>{session ? <Status value={session.evidence.length ? 'completed' : 'draft'} labels={{ completed: 'เชื่อมแล้ว', draft: 'ยังไม่เชื่อม' }} /> : null}</div>{!session ? <div className="evac-empty"><p>เลือกผลการซ้อมจากตารางก่อน จึงจะเชื่อมหลักฐานได้</p></div> : !attachments.length ? <div className="evac-callout" data-tone="danger"><strong>งานยังไม่มีไฟล์หลักฐาน</strong><span>เปิดโมดูลงานและหลักฐานเพื่อแนบไฟล์ก่อน แล้วกลับมาเชื่อมไฟล์กับผลซ้อม</span><Link className="evac-link" href="/staff/safety">เปิดงานและหลักฐาน</Link></div> : <div className="evac-list">{attachments.map(attachment => { const linked = session.evidence.find(item => item.attachmentId === attachment.id); const role = roles[attachment.id] ?? linked?.evidenceRole ?? (attachment.evidenceKind === 'attendance' ? 'attendance' : 'evaluation'); return <div className="evac-list-item" key={attachment.id}><div className="evac-card-head"><strong>{attachment.fileName}</strong><span className="evac-muted">{formatDateTime(attachment.uploadedAt)}</span></div><div className="evac-inline"><a className="evac-link" href={`/api/admin/safety-tasks/attachments/${attachment.id}`} target="_blank" rel="noreferrer">เปิดไฟล์</a><select disabled={!canEdit || busy} value={role} onChange={event => setRoles(current => ({ ...current, [attachment.id]: event.target.value as typeof EVIDENCE_ROLES[number] }))}>{EVIDENCE_ROLES.map(item => <option key={item} value={item}>{EVIDENCE_ROLE_LABELS[item]}</option>)}</select><Button size="lg" variant={linked ? 'secondary' : 'primary'} disabled={!canEdit || busy} onClick={() => void onLink(session, attachment.id, role)}>{linked ? 'อัปเดตการเชื่อม' : 'เชื่อมกับผลซ้อม'}</Button></div></div> })}</div>}</article>
}

function TasksPanel({ dashboard, onTab }: { dashboard: EvacuationDashboardDTO; onTab: (tab: Tab) => void }) {
  return <section className="evac-panel" id="evac-panel-tasks" role="tabpanel" aria-label="งานและหลักฐาน"><div className="evac-toolbar"><div><h2 style={{ margin: 0, fontSize: 19 }}>งานและหลักฐานที่เชื่อม</h2><p className="evac-help" style={{ margin: '4px 0 0' }}>สถานะและไฟล์อ่านจากระบบงานจริง เพื่อให้ audit trail อยู่จุดเดียวกับงานคุณภาพ/ความปลอดภัย</p></div><Button variant="secondary" size="lg" icon="arrowRight" onClick={() => onTab('drills')}>ไปเชื่อมหลักฐานกับผลซ้อม</Button></div><div className="evac-table-wrap"><table className="evac-table"><thead><tr><th>งาน</th><th>สถานะ</th><th>เชื่อมกับ</th><th>ข้อกำหนดหลักฐาน</th><th>ไฟล์</th></tr></thead><tbody>{dashboard.tasks.map(task => <tr key={task.key}><td><strong>{task.sourceKey ?? task.key}</strong><br />{task.title}<div className="evac-muted">{task.periodLabel} · ครบกำหนด {formatDate(task.dueDate)}</div></td><td><Status value={task.status} labels={{ open: 'เปิดงาน', in_progress: 'กำลังทำ', pending_review: 'รอตรวจ', completed: 'เสร็จสิ้น' }} /></td><td>{task.link ? <><Status value={task.link.syncStatus === 'failed' ? 'retired' : 'completed'} labels={{ completed: task.link.integrationKind === 'evacuation_drill' ? 'รอบซ้อม' : 'แผนทบทวน', retired: 'เชื่อมล้มเหลว' }} /><div className="evac-muted">{task.link.sourceId}</div></> : 'ยังไม่เชื่อม'}</td><td>{task.requirements.length ? task.requirements.map(requirement => <div key={requirement.id}>{requirement.label}: {requirement.attachedCount}/{requirement.minimumFiles}{requirement.required ? ' · บังคับ' : ''}</div>) : 'ไม่มีข้อกำหนด'}</td><td>{task.attachments.length ? <ul style={{ margin: 0, paddingLeft: 16 }}>{task.attachments.map(attachment => <li key={attachment.id}><a className="evac-link" href={`/api/admin/safety-tasks/attachments/${attachment.id}`} target="_blank" rel="noreferrer">{attachment.fileName}</a></li>)}</ul> : <Link className="evac-link" href="/staff/safety">เปิดงานเพื่อแนบหลักฐาน</Link>}</td></tr>)}</tbody></table>{!dashboard.tasks.length ? <div className="evac-empty"><p>ยังไม่พบ occurrence ของงาน CBH-ST-15/17/21 ในรอบปีปัจจุบัน</p></div> : null}</div></section>
}
