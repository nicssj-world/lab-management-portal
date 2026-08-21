import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import { bangkokToday } from './logic'
import {
  MONTHLY_SAFETY_PROFILES,
  isMonthlySafetyProfile,
  monthlyPeriod,
  pointStatusForMonth,
  validateNssSubmission,
  validateSpillKitSubmission,
  validateSupplyReplacements,
  type MonthlySafetyPoint,
  type NssInspectionPayload,
  type SafetyAssetAssignment,
  type SafetyInspectionProfileKey,
  type SafetySupplyRecord,
  type SafetySupplyReplacementInput,
  type SpillKitInspectionPayload,
} from './monthly-safety'
import type { MonthlySafetyReportRow } from './monthly-safety-pdf'

type Row = Record<string, any>
type MonthlyPayload = SpillKitInspectionPayload | NssInspectionPayload
type WorkflowPayload =
  | { action: 'skip'; reason: string }
  | { action: 'reassign'; assignments: { userId: string; assignmentRole: 'primary' | 'backup' }[] }

const PARENT_SOURCE_KEYS = ['CBH-ST-04', 'CBH-ST-26'] as const
const PROFILE_BY_TASK: Record<(typeof PARENT_SOURCE_KEYS)[number], SafetyInspectionProfileKey[]> = {
  'CBH-ST-04': ['biohazard_spill_kit', 'chemical_spill_kit'],
  'CBH-ST-26': ['nss_eyewash'],
}

function fail(error: { message?: string } | null | undefined, fallback = 'Monthly safety operation failed') {
  if (error) throw new Error(error.message || fallback)
}
function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function rows(value: unknown): Row[] { return Array.isArray(value) ? value as Row[] : [] }

async function audit(actorId: string, action: string, target: string, detail: unknown) {
  fail((await supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail: JSON.stringify(detail) })).error, 'Audit failed')
}

function activeOn(row: Row, date: string, fromKey: string, toKey: string) {
  return str(row[fromKey]) <= date && (!row[toKey] || str(row[toKey]) >= date)
}

function assignmentSnapshot(assignments: Row[], people: Map<string, Row>): SafetyAssetAssignment[] {
  return assignments.map(row => ({
    userId: str(row.user_id),
    assignmentRole: str(row.assignment_role) === 'backup' ? 'backup' : 'primary',
    userName: nullable(people.get(str(row.user_id))?.name),
  }))
}

function supplySnapshot(row: Row): SafetySupplyRecord {
  return {
    id: str(row.id), assetId: str(row.asset_id), templateItemId: nullable(row.template_item_id),
    supplyType: str(row.supply_type) === 'nss_bottle' ? 'nss_bottle' : 'spill_item',
    internalCode: str(row.internal_code), labelTh: str(row.label_th),
    manufacturedOrPackedOn: nullable(row.manufactured_or_packed_on), purchasedOn: nullable(row.purchased_on),
    expiresOn: nullable(row.expires_on), supplier: nullable(row.supplier),
    activatedOn: str(row.activated_on), retiredOn: nullable(row.retired_on),
  }
}

async function loadMaterializationData(periodStart: string) {
  const { data: taskTemplates, error: taskError } = await supabaseAdmin.from('quality_task_templates').select('*')
    .eq('workstream', 'safety').in('source_key', ['CBH-ST-04', 'CBH-ST-26']).eq('active', true)
  fail(taskError)
  const taskIds = rows(taskTemplates).map(row => str(row.id))
  const { data: schedules, error: scheduleError } = taskIds.length
    ? await supabaseAdmin.from('quality_task_schedules').select('*').in('template_id', taskIds).eq('active', true)
    : { data: [], error: null }
  fail(scheduleError)

  const { data: formTemplates, error: formError } = await supabaseAdmin.from('lab_map_safety_form_templates').select('*').eq('active', true)
  fail(formError)
  const formIds = rows(formTemplates).map(row => str(row.id))
  const { data: templateItems, error: itemError } = formIds.length
    ? await supabaseAdmin.from('lab_map_safety_form_template_items').select('*').in('template_id', formIds).order('sort_order')
    : { data: [], error: null }
  fail(itemError)

  const activeProfiles = rows(formTemplates).map(row => str(row.profile))
  const { data: assets, error: assetError } = activeProfiles.length
    ? await supabaseAdmin.from('lab_map_safety_assets').select('*').eq('lifecycle_status', 'active').order('code')
    : { data: [], error: null }
  fail(assetError)
  const assetIds = rows(assets).map(row => str(row.id))
  const [{ data: assignments, error: assignmentError }, { data: profileHistory, error: profileHistoryError }, { data: supplies, error: supplyError }] = assetIds.length
    ? await Promise.all([
        supabaseAdmin.from('lab_map_safety_asset_assignments').select('*').in('asset_id', assetIds).lte('active_from', periodStart),
        supabaseAdmin.from('lab_map_safety_asset_profile_history').select('*').in('asset_id', assetIds).lte('active_from', periodStart),
        supabaseAdmin.from('lab_map_safety_asset_supplies').select('*').in('asset_id', assetIds).lte('activated_on', periodStart),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }]
  fail(assignmentError); fail(profileHistoryError); fail(supplyError)
  const activeAssignments = rows(assignments).filter(row => activeOn(row, periodStart, 'active_from', 'active_to'))
  const activeProfileRows = rows(profileHistory).filter(row => activeOn(row, periodStart, 'active_from', 'active_to') && activeProfiles.includes(str(row.profile)))
    .sort((left, right) => str(right.active_from).localeCompare(str(left.active_from)))
  const activeProfileByAsset = new Map<string, Row>()
  for (const profile of activeProfileRows) if (!activeProfileByAsset.has(str(profile.asset_id))) activeProfileByAsset.set(str(profile.asset_id), profile)
  const activeSupplies = rows(supplies).filter(row => activeOn(row, periodStart, 'activated_on', 'retired_on'))
  const userIds = [...new Set(activeAssignments.map(row => str(row.user_id)).filter(Boolean))]
  const { data: profiles, error: profileError } = userIds.length
    ? await supabaseAdmin.from('profiles').select('id,name,dept').in('id', userIds)
    : { data: [], error: null }
  fail(profileError)
  const assetsForPeriod: Row[] = rows(assets).map((asset): Row => ({
    ...asset, inspection_profile: activeProfileByAsset.get(str(asset.id))?.profile ?? null,
  })).filter(asset => Boolean(asset.inspection_profile))

  return {
    taskTemplates: rows(taskTemplates), schedules: rows(schedules), formTemplates: rows(formTemplates),
    templateItems: rows(templateItems), assets: assetsForPeriod, assignments: activeAssignments,
    supplies: activeSupplies, people: new Map(rows(profiles).map(row => [str(row.id), row])),
  }
}

async function ensureTaskInstance(template: Row, schedule: Row, month: string, actorId: string) {
  const period = monthlyPeriod(month, Number(schedule.due_day_of_month ?? 15))
  const { data, error } = await supabaseAdmin.from('quality_task_instances').upsert({
    template_id: template.id, schedule_id: schedule.id, period_start: period.start, period_end: period.end,
    period_label: new Date(`${period.start}T00:00:00+07:00`).toLocaleDateString('th-TH', { month: 'long', year: 'numeric' }),
    planned_date: period.dueOn, created_by: actorId, updated_by: actorId,
  }, { onConflict: 'schedule_id,period_start' }).select('*').single()
  fail(error)
  return { instance: data as Row, period }
}

async function ensureMonthlyRound(instance: Row, title: string, profiles: SafetyInspectionProfileKey[], month: string, actorId: string) {
  const { data: existing, error: existingError } = await supabaseAdmin.from('quality_task_links').select('source_id')
    .eq('instance_id', instance.id).eq('integration_kind', 'safety_inspection').contains('metadata', { source: 'monthly_safety' }).maybeSingle()
  fail(existingError)
  if (existing) return str(existing.source_id)

  const { data: round, error: roundError } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').insert({
    name_th: `${title} - ${month}`, filter_snapshot: { source: 'monthly_safety', month, profiles }, started_by: actorId,
  }).select('id').single()
  fail(roundError)
  try {
    fail((await supabaseAdmin.from('quality_task_links').insert({
      instance_id: instance.id, integration_kind: 'safety_inspection', source_type: 'lab_map_safety_inspection_round',
      source_id: round!.id, sync_status: 'pending', metadata: { source: 'monthly_safety', month }, created_by: actorId,
    })).error)
  } catch (error) {
    await supabaseAdmin.from('lab_map_safety_inspection_rounds').delete().eq('id', round!.id)
    throw error
  }
  return str(round!.id)
}

export async function materializeMonthlySafetyInspections(month: string, actor: Actor, isEditor: boolean) {
  const periodStart = `${month}-01`
  const data = await loadMaterializationData(periodStart)
  let createdItems = 0
  for (const task of data.taskTemplates) {
    const sourceKey = str(task.source_key) as (typeof PARENT_SOURCE_KEYS)[number]
    if (!PARENT_SOURCE_KEYS.includes(sourceKey)) continue
    const schedule = data.schedules.find(row => str(row.template_id) === str(task.id) && str(row.interval_unit) === 'month'
      && str(row.starts_on) <= periodStart && (!row.ends_on || str(row.ends_on) >= periodStart))
    if (!schedule) continue
    const taskProfiles = PROFILE_BY_TASK[sourceKey]
    const eligibleAssets = data.assets.filter(asset => taskProfiles.includes(str(asset.inspection_profile) as SafetyInspectionProfileKey))
    if (!eligibleAssets.length) continue
    const { instance, period } = await ensureTaskInstance(task, schedule, month, actor.id)
    const roundId = await ensureMonthlyRound(instance, str(task.title), taskProfiles, month, actor.id)
    const existingResult = await supabaseAdmin.from('lab_map_safety_inspection_round_items').select('asset_id').eq('round_id', roundId)
    fail(existingResult.error)
    const existingAssetIds = new Set(rows(existingResult.data).map(row => str(row.asset_id)))
    const newRows: Row[] = []
    for (const asset of eligibleAssets) {
      if (existingAssetIds.has(str(asset.id))) continue
      const template = data.formTemplates.find(row => str(row.profile) === str(asset.inspection_profile))
      if (!template) continue
      const assignments = data.assignments.filter(row => str(row.asset_id) === str(asset.id))
      const items = data.templateItems.filter(row => str(row.template_id) === str(template.id)).map(row => ({
        id: str(row.id), itemKey: str(row.item_key), labelTh: str(row.label_th), sortOrder: Number(row.sort_order),
        expiryRequired: Boolean(row.expiry_required), dateMode: str(row.date_mode),
      }))
      const itemOrder = new Map(items.map(item => [item.id, item.sortOrder]))
      const supplies = data.supplies.filter(row => str(row.asset_id) === str(asset.id)).map(supplySnapshot)
        .sort((left, right) => (itemOrder.get(left.templateItemId ?? '') ?? 999) - (itemOrder.get(right.templateItemId ?? '') ?? 999)
          || left.internalCode.localeCompare(right.internalCode, 'th', { numeric: true }))
      newRows.push({
        round_id: roundId, asset_id: asset.id, sequence_no: newRows.length + existingAssetIds.size + 1,
        task_instance_id: instance.id, template_id: template.id, due_on: period.dueOn,
        assignee_snapshot: assignmentSnapshot(assignments, data.people),
        template_snapshot: { profile: asset.inspection_profile, version: Number(template.version), titleTh: template.title_th, items, supplies },
      })
    }
    if (newRows.length) {
      fail((await supabaseAdmin.from('lab_map_safety_inspection_round_items').insert(newRows)).error)
      createdItems += newRows.length
    }
  }
  if (createdItems) await audit(actor.id, 'safety_task.monthly.materialize', month, { createdItems, isEditor })
  return { createdItems }
}

function mapPoint(row: Row, today: string): MonthlySafetyPoint {
  const asset = row.asset as Row
  const submittedBy = row.submitter as Row | null
  const snapshot = row.template_snapshot as Row
  return {
    roundItemId: str(row.id), taskInstanceId: str(row.task_instance_id), assetId: str(row.asset_id),
    assetCode: str(asset?.code), assetName: str(asset?.name_th),
    profile: str(snapshot?.profile) as SafetyInspectionProfileKey,
    department: nullable(asset?.department), dueOn: str(row.due_on),
    status: pointStatusForMonth({ submittedAt: nullable(row.submitted_at), issueCount: Number(row.issue_count ?? 0), skippedAt: nullable(row.skipped_at), dueOn: str(row.due_on) }, today),
    issueCount: Number(row.issue_count ?? 0), submittedAt: nullable(row.submitted_at),
    submittedByName: nullable(submittedBy?.name), assignments: (row.assignee_snapshot ?? []) as SafetyAssetAssignment[],
  }
}

export async function listMonthlySafetyPoints(
  month: string,
  actor: Actor,
  isEditor: boolean,
  scope: 'mine' | 'all' = 'mine',
) {
  await materializeMonthlySafetyInspections(month, actor, isEditor)
  const period = monthlyPeriod(month)
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('*,asset:lab_map_safety_assets(id,code,name_th,space_code,department,inspection_profile),submitter:profiles!lab_map_safety_inspection_round_items_submitted_by_fkey(name)')
    .gte('due_on', period.start).lte('due_on', period.end)
    .in('template_snapshot->>profile', MONTHLY_SAFETY_PROFILES)
    .order('due_on').order('sequence_no')
  fail(error)
  const today = bangkokToday()
  const points = rows(data).map(row => mapPoint(row, today)).filter(point => {
    if (!isMonthlySafetyProfile(point.profile)) return false
    if (isEditor && scope === 'all') return true
    return point.assignments.some(assignment => assignment.userId === actor.id)
  })
  const summary = {
    total: points.length,
    pending: points.filter(point => point.status === 'pending' || point.status === 'due_soon').length,
    overdue: points.filter(point => point.status === 'overdue').length,
    submitted: points.filter(point => point.status === 'submitted' || point.status === 'submitted_with_issues').length,
    issues: points.filter(point => point.issueCount > 0).length,
  }
  return { month, points, summary }
}

async function loadRoundItem(roundItemId: string) {
  const { data, error } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('*,asset:lab_map_safety_assets(id,code,name_th,space_code,department,inspection_profile),inspection:lab_map_safety_inspections!lab_map_safety_inspection_round_items_inspection_id_fkey(*)')
    .eq('id', roundItemId).maybeSingle()
  fail(error)
  if (!data) throw new Error('Monthly safety point not found')
  const row = data as Row
  // Items from a task-opened inspection round live in the same table but have no
  // profile snapshot; opening one as a monthly form would render an empty checklist.
  if (!isMonthlySafetyProfile((row.template_snapshot as Row)?.profile)) {
    throw new Error('รายการนี้ไม่ใช่จุดตรวจประจำเดือน กรุณาเปิดจากรอบตรวจอุปกรณ์ในแท็บรายการงาน')
  }
  return row
}

function assertPointAccess(row: Row, actor: Actor, isEditor: boolean) {
  if (isEditor) return
  const assignments = (row.assignee_snapshot ?? []) as SafetyAssetAssignment[]
  if (!assignments.some(assignment => assignment.userId === actor.id)) throw new Error('Forbidden')
}

export async function getMonthlySafetyForm(roundItemId: string, actor: Actor, isEditor: boolean) {
  const row = await loadRoundItem(roundItemId)
  assertPointAccess(row, actor, isEditor)
  return {
    point: mapPoint(row, bangkokToday()),
    template: row.template_snapshot ?? {},
    inspection: row.inspection ?? null,
  }
}

async function syncParentState(row: Row, actorId: string) {
  const { data: siblings, error } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('status,issue_count').eq('round_id', row.round_id)
  fail(error)
  const items = rows(siblings)
  const complete = items.length > 0 && items.every(item => ['completed', 'skipped'].includes(str(item.status)))
  const now = new Date().toISOString()
  if (complete) {
    fail((await supabaseAdmin.from('lab_map_safety_inspection_rounds').update({ status: 'closed', closed_by: actorId, closed_at: now }).eq('id', row.round_id)).error)
    fail((await supabaseAdmin.from('quality_task_instances').update({
      status: 'completed', submitted_by: actorId, submitted_at: now, completed_by: actorId, completed_at: now,
      completion_note: `ตรวจครบ ${items.length} จุด พบปัญหา ${items.filter(item => Number(item.issue_count) > 0).length} จุด`,
      updated_by: actorId, updated_at: now,
    }).eq('id', row.task_instance_id)).error)
    fail((await supabaseAdmin.from('quality_task_links').update({ sync_status: 'synced', metadata: { source: 'monthly_safety', total: items.length, issues: items.filter(item => Number(item.issue_count) > 0).length }, updated_at: now }).eq('instance_id', row.task_instance_id).eq('integration_kind', 'safety_inspection').contains('metadata', { source: 'monthly_safety' })).error)
  } else {
    fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'in_progress', updated_by: actorId, updated_at: now }).eq('id', row.task_instance_id)).error)
  }
}

function capaDescription(row: Row, payload: MonthlyPayload) {
  const asset = row.asset as Row
  if (payload.kind === 'spill_kit') {
    const issues = payload.answers.filter(answer => !['normal', 'na'].includes(answer.result))
      .map(answer => `${answer.itemKey}: ${answer.result}${answer.note ? ` - ${answer.note}` : ''}`)
    return `แก้ไขข้อบกพร่อง ${str(asset.name_th)} (${str(asset.code)}): ${issues.join('; ')}`
  }
  const issues = payload.bottles.filter(bottle => bottle.clarity === 'turbid' || bottle.bottleCondition === 'cracked' || Boolean(bottle.correctiveAction?.trim()))
    .map(bottle => `${bottle.supplyId}: ${bottle.clarity}/${bottle.bottleCondition} - ${bottle.correctiveAction ?? ''}`)
  return `แก้ไขข้อบกพร่อง NSS ${str(asset.name_th)} (${str(asset.code)}): ${issues.join('; ')}`
}

async function applySupplyReplacements(
  row: Row,
  replacements: SafetySupplyReplacementInput[],
  snapshotSupplies: Row[],
  replacedOn: string,
  actorId: string,
) {
  if (!replacements.length) return { oldIds: [] as string[], newIds: [] as string[] }
  const oldIds = replacements.map(item => item.oldSupplyId)
  const snapshotById = new Map(snapshotSupplies.map(item => [str(item.id), item]))
  if (oldIds.some(id => !snapshotById.has(id))) throw new Error('ไม่พบ inventory เดิมใน snapshot ของรอบตรวจ')
  const currentResult = await supabaseAdmin.from('lab_map_safety_asset_supplies').select('id').eq('asset_id', row.asset_id).in('id', oldIds).is('retired_on', null)
  fail(currentResult.error)
  if (rows(currentResult.data).length !== oldIds.length) throw new Error('inventory บางรายการถูกเปลี่ยนโดยผู้ใช้อื่นแล้ว กรุณาโหลดใหม่')
  fail((await supabaseAdmin.from('lab_map_safety_asset_supplies').update({ retired_on: replacedOn }).in('id', oldIds).eq('asset_id', row.asset_id)).error)
  const inserts = replacements.map(item => {
    const old = snapshotById.get(item.oldSupplyId)!
    return {
      asset_id: row.asset_id, template_item_id: old.templateItemId ?? old.template_item_id ?? null,
      supply_type: old.supplyType ?? old.supply_type, internal_code: item.internalCode,
      label_th: item.labelTh, manufactured_or_packed_on: item.manufacturedOrPackedOn,
      purchased_on: item.purchasedOn, expires_on: item.expiresOn, supplier: item.supplier,
      activated_on: replacedOn, replacement_for_id: item.oldSupplyId, created_by: actorId,
    }
  })
  const insertResult = await supabaseAdmin.from('lab_map_safety_asset_supplies').insert(inserts).select('id,replacement_for_id')
  if (insertResult.error) {
    await supabaseAdmin.from('lab_map_safety_asset_supplies').update({ retired_on: null }).in('id', oldIds)
    fail(insertResult.error)
  }
  const created = rows(insertResult.data)
  for (const item of replacements) item.newSupplyId = str(created.find(createdItem => str(createdItem.replacement_for_id) === item.oldSupplyId)?.id)
  return { oldIds, newIds: created.map(item => str(item.id)) }
}

async function rollbackSupplyReplacements(change: { oldIds: string[]; newIds: string[] }) {
  if (change.newIds.length) await supabaseAdmin.from('lab_map_safety_asset_supplies').delete().in('id', change.newIds)
  if (change.oldIds.length) await supabaseAdmin.from('lab_map_safety_asset_supplies').update({ retired_on: null }).in('id', change.oldIds)
}

export async function submitMonthlySafetyInspection(roundItemId: string, payload: MonthlyPayload, actor: Actor, isEditor: boolean) {
  const row = await loadRoundItem(roundItemId)
  assertPointAccess(row, actor, isEditor)
  if (str(row.status) !== 'pending') throw new Error('รายการนี้ส่งผลตรวจหรือถูกข้ามแล้ว')
  const snapshot = row.template_snapshot as Row
  const supplies = rows(snapshot.supplies)
  const replacements = payload.replacements ?? []
  let validation: { ok: true; issueCount: number } | { ok: false; error: string }
  let abnormalSupplyIds: Set<string>
  if (payload.kind === 'spill_kit') {
    const expected = new Set(supplies.map(supply => str(supply.id)))
    const submitted = new Set(payload.answers.map(answer => answer.supplyId))
    if (!expected.size || expected.size !== submitted.size || [...expected].some(id => !submitted.has(id))) {
      throw new Error('กรุณาตรวจรายการใน Spill kit ให้ครบทุกข้อ')
    }
    validation = validateSpillKitSubmission(payload)
    abnormalSupplyIds = new Set(payload.answers.filter(answer => !['normal', 'na'].includes(answer.result)).map(answer => answer.supplyId))
  } else {
    payload.activeBottleIds = supplies.filter(supply => str(supply.supplyType ?? supply.supply_type) === 'nss_bottle').map(supply => str(supply.id))
    validation = validateNssSubmission(payload)
    const expiredIds = new Set(supplies.filter(supply => supply.expiresOn && str(supply.expiresOn) < bangkokToday()).map(supply => str(supply.id)))
    const expiredWithoutAction = payload.bottles.find(bottle => expiredIds.has(bottle.supplyId) && !bottle.correctiveAction?.trim())
    if (expiredWithoutAction) throw new Error('ขวด NSS ที่หมดอายุต้องระบุการแก้ไขปัญหา')
    abnormalSupplyIds = new Set(payload.bottles.filter(bottle => bottle.clarity === 'turbid' || bottle.bottleCondition === 'cracked' || expiredIds.has(bottle.supplyId)).map(bottle => bottle.supplyId))
  }
  if (!validation.ok) throw new Error(validation.error)
  const replacementValidation = validateSupplyReplacements(replacements, abnormalSupplyIds)
  if (!replacementValidation.ok) throw new Error(replacementValidation.error)
  const issueCount = Math.max(validation.issueCount, abnormalSupplyIds.size)
  const now = new Date().toISOString()
  const result = issueCount > 0 ? 'needs_attention' : 'passed'
  const replacedOn = payload.kind === 'spill_kit' ? payload.inspectedOn : bangkokToday()
  const replacementChange = await applySupplyReplacements(row, replacements, supplies, replacedOn, actor.id)
  const { data: inspection, error: inspectionError } = await supabaseAdmin.from('lab_map_safety_inspections').insert({
    asset_id: row.asset_id, result, inspected_on: payload.kind === 'spill_kit' ? payload.inspectedOn : bangkokToday(),
    next_inspection_date: null, expires_on: null, note: issueCount ? capaDescription(row, payload) : null,
    photo_r2_key: null, photo_file_name: null, photo_content_type: null, photo_size_bytes: null,
    inspected_by: actor.id, round_item_id: row.id, inspection_profile: snapshot.profile ?? (row.asset as Row).inspection_profile,
    checklist_snapshot: [], form_snapshot: { template: snapshot, submission: payload },
  }).select('id').single()
  if (inspectionError) {
    await rollbackSupplyReplacements(replacementChange)
    fail(inspectionError)
  }
  try {
    const completion = await supabaseAdmin.from('lab_map_safety_inspection_round_items').update({
      status: 'completed', inspection_id: inspection!.id, completed_at: now,
      submitted_by: actor.id, submitted_at: now, issue_count: issueCount,
    }).eq('id', row.id).eq('status', 'pending').select('id').maybeSingle()
    fail(completion.error)
    if (!completion.data) throw new Error('รายการนี้ถูกส่งโดยผู้ใช้อื่นแล้ว กรุณาโหลดใหม่')
    if (issueCount > 0) {
      const due = new Date(now); due.setUTCDate(due.getUTCDate() + 30)
      const assignments = (row.assignee_snapshot ?? []) as SafetyAssetAssignment[]
      const ownerId = assignments.find(item => item.assignmentRole === 'primary')?.userId ?? actor.id
      fail((await supabaseAdmin.from('quality_task_action_items').upsert({
        instance_id: row.task_instance_id, user_id: ownerId, manual_name: null,
        description: capaDescription(row, payload), due_date: due.toISOString().slice(0, 10),
        source_type: 'monthly_safety', source_id: row.id, created_by: actor.id, updated_at: now,
      }, { onConflict: 'instance_id,source_type,source_id' })).error)
      await audit(actor.id, 'safety_task.monthly.capa.create', row.id, { issueCount, inspectionId: inspection!.id })
    }
    await syncParentState(row, actor.id)
    if (replacementChange.newIds.length) await audit(actor.id, 'safety_task.monthly.replacement', row.id, { oldSupplyIds: replacementChange.oldIds, newSupplyIds: replacementChange.newIds })
    await audit(actor.id, 'safety_task.monthly.submit', row.id, { issueCount, inspectionId: inspection!.id })
  } catch (error) {
    await supabaseAdmin.from('quality_task_action_items').delete().eq('instance_id', row.task_instance_id).eq('source_type', 'monthly_safety').eq('source_id', row.id)
    await supabaseAdmin.from('lab_map_safety_inspection_round_items').update({ status: 'pending', inspection_id: null, completed_at: null, submitted_by: null, submitted_at: null, issue_count: 0 }).eq('id', row.id).eq('inspection_id', inspection!.id)
    await rollbackSupplyReplacements(replacementChange)
    await supabaseAdmin.from('lab_map_safety_inspections').delete().eq('id', inspection!.id)
    throw error
  }
  return { inspectionId: str(inspection!.id), issueCount, status: result }
}

export async function updateMonthlySafetyPointWorkflow(roundItemId: string, payload: WorkflowPayload, actor: Actor, isEditor: boolean) {
  if (!isEditor) throw new Error('Forbidden')
  const row = await loadRoundItem(roundItemId)
  if (str(row.status) !== 'pending') throw new Error('แก้ workflow ได้เฉพาะรายการที่ยังไม่ส่ง')
  if (payload.action === 'skip') {
    const reason = payload.reason.trim()
    if (!reason) throw new Error('กรุณาระบุเหตุผลที่ข้ามจุดตรวจ')
    const now = new Date().toISOString()
    fail((await supabaseAdmin.from('lab_map_safety_inspection_round_items').update({
      status: 'skipped', skipped_by: actor.id, skipped_at: now, skip_reason: reason, completed_at: now,
    }).eq('id', row.id).eq('status', 'pending')).error)
    await syncParentState(row, actor.id)
    await audit(actor.id, 'safety_task.monthly.skip', row.id, { reason })
  } else {
    const userIds = [...new Set(payload.assignments.map(item => item.userId))]
    const { data: people, error } = userIds.length
      ? await supabaseAdmin.from('profiles').select('id,name').in('id', userIds)
      : { data: [], error: null }
    fail(error)
    if (rows(people).length !== userIds.length) throw new Error('ไม่พบผู้รับผิดชอบบางราย')
    const peopleById = new Map(rows(people).map(person => [str(person.id), person]))
    const snapshot: SafetyAssetAssignment[] = payload.assignments.map(item => ({
      userId: item.userId, assignmentRole: item.assignmentRole, userName: nullable(peopleById.get(item.userId)?.name),
    }))
    fail((await supabaseAdmin.from('lab_map_safety_inspection_round_items').update({ assignee_snapshot: snapshot }).eq('id', row.id).eq('status', 'pending')).error)
    await audit(actor.id, 'safety_task.monthly.reassign', row.id, { assignments: snapshot })
  }
  return getMonthlySafetyForm(roundItemId, actor, true)
}

export async function getMonthlySafetyReportRows(
  fiscalYear: number,
  actor: Actor,
  isEditor: boolean,
  filters: { assetId?: string; roundItemId?: string; month?: string } = {},
) {
  const gregorianEndYear = fiscalYear - 543
  let query = supabaseAdmin.from('lab_map_safety_inspection_round_items')
    .select('*,asset:lab_map_safety_assets(id,code,name_th,inspection_profile),inspection:lab_map_safety_inspections!lab_map_safety_inspection_round_items_inspection_id_fkey(form_snapshot),submitter:profiles!lab_map_safety_inspection_round_items_submitted_by_fkey(name)')
    .gte('due_on', `${gregorianEndYear - 1}-10-01`).lte('due_on', `${gregorianEndYear}-09-30`)
    .in('template_snapshot->>profile', MONTHLY_SAFETY_PROFILES)
    .order('due_on').order('sequence_no')
  if (filters.assetId) query = query.eq('asset_id', filters.assetId)
  if (filters.roundItemId) query = query.eq('id', filters.roundItemId)
  if (filters.month) {
    const period = monthlyPeriod(filters.month)
    query = query.gte('due_on', period.start).lte('due_on', period.end)
  }
  const { data, error } = await query
  fail(error)
  return rows(data).filter(row => {
    if (!isMonthlySafetyProfile((row.template_snapshot as Row)?.profile)) return false
    if (isEditor) return true
    return ((row.assignee_snapshot ?? []) as SafetyAssetAssignment[]).some(item => item.userId === actor.id)
  }).map((row): MonthlySafetyReportRow => {
    const asset = row.asset as Row
    const inspection = row.inspection as Row | null
    const submitter = row.submitter as Row | null
    return {
      roundItemId: str(row.id), assetId: str(row.asset_id), assetCode: str(asset?.code), assetName: str(asset?.name_th),
      profile: str((row.template_snapshot as Row)?.profile) as SafetyInspectionProfileKey, dueOn: str(row.due_on),
      submittedAt: nullable(row.submitted_at), submittedByName: nullable(submitter?.name), status: str(row.status),
      issueCount: Number(row.issue_count ?? 0), templateSnapshot: (row.template_snapshot ?? {}) as Row,
      formSnapshot: (inspection?.form_snapshot ?? {}) as Row,
    }
  })
}
