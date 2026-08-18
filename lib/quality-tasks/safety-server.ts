import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { PermLevel } from '@/lib/permissions'
import { getOccurrenceAccess, getOccurrenceReadAccess } from './server'
import { bangkokToday } from './logic'
import { fiscalYearForDate } from './safety'
import type { SafetyCertificate } from './types'

type Row = Record<string, any>

function fail(error: { message: string } | null, fallback = 'Safety task operation failed') {
  if (error) throw new Error(error.message || fallback)
}
function str(value: unknown) { return typeof value === 'string' ? value : '' }
function nullable(value: unknown) { return typeof value === 'string' ? value : null }
function isUniqueViolation(error: { code?: string; message?: string } | null) {
  return error?.code === '23505' || /duplicate key|unique constraint/i.test(error?.message ?? '')
}

function audit(actorId: string, action: string, target: string, detail: unknown) {
  supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail: JSON.stringify(detail) }).then(undefined, () => {})
}

export async function listSafetyCertificates(): Promise<SafetyCertificate[]> {
  const { data: rows, error } = await supabaseAdmin.from('safety_certificates').select('*').eq('active', true).order('expires_on', { ascending: true, nullsFirst: false })
  fail(error)
  const versionIds = (rows ?? []).map((row: Row) => nullable(row.current_version_id)).filter((id): id is string => Boolean(id))
  const renewalCertificateIds = (rows ?? []).map((row: Row) => str(row.id))
  const [{ data: versions, error: versionError }, { data: renewals, error: renewalError }] = await Promise.all([
    versionIds.length ? supabaseAdmin.from('safety_certificate_versions').select('*').in('id', versionIds) : Promise.resolve({ data: [], error: null }),
    renewalCertificateIds.length ? supabaseAdmin.from('safety_certificate_renewals').select('*').in('certificate_id', renewalCertificateIds) : Promise.resolve({ data: [], error: null }),
  ])
  fail(versionError); fail(renewalError)
  const versionById = new Map(((versions ?? []) as Row[]).map(row => [str(row.id), row]))
  const renewalByKey = new Map(((renewals ?? []) as Row[]).map(row => [`${str(row.certificate_id)}:${str(row.expires_on)}`, row]))
  return ((rows ?? []) as Row[]).map(row => {
    const version = versionById.get(str(row.current_version_id)) ?? {}
    const renewal = renewalByKey.get(`${str(row.id)}:${str(row.expires_on)}`)
    return {
      id: str(row.id), certificateType: str(row.certificate_type), documentNo: nullable(row.document_no),
      holderName: str(row.holder_name), department: nullable(row.department), issuedOn: nullable(row.issued_on),
      expiresOn: nullable(row.expires_on), noExpiry: Boolean(row.no_expiry), ownerId: nullable(row.owner_id),
      fileName: str(version.file_name), contentType: str(version.content_type), sizeBytes: Number(version.size_bytes ?? 0),
      uploadedAt: str(version.uploaded_at), renewalInstanceId: renewal ? nullable(renewal.instance_id) : null,
    }
  })
}

export type CertificateInput = {
  certificateType: string
  documentNo: string | null
  holderName: string
  department: string | null
  issuedOn: string | null
  expiresOn: string | null
  noExpiry: boolean
  ownerId: string | null
}

export async function createSafetyCertificate(input: CertificateInput, file: { key: string; fileName: string; contentType: string; sizeBytes: number }, actor: Actor) {
  const { data: certificate, error } = await supabaseAdmin.from('safety_certificates').insert({
    certificate_type: input.certificateType.trim(), document_no: input.documentNo?.trim() || null,
    holder_name: input.holderName.trim(), department: input.department?.trim() || null, issued_on: input.issuedOn,
    expires_on: input.noExpiry ? null : input.expiresOn, no_expiry: input.noExpiry, owner_id: input.ownerId,
    created_by: actor.id, updated_by: actor.id,
  }).select('id').single()
  fail(error)
  if (!certificate) throw new Error('Certificate was not created')
  let versionId: string | null = null
  try {
    const { data: version, error: versionError } = await supabaseAdmin.from('safety_certificate_versions').insert({
      certificate_id: certificate.id, r2_key: file.key, file_name: file.fileName, content_type: file.contentType,
      size_bytes: file.sizeBytes, uploaded_by: actor.id, certificate_type: input.certificateType.trim(),
      document_no: input.documentNo?.trim() || null, holder_name: input.holderName.trim(), department: input.department?.trim() || null,
      issued_on: input.issuedOn, expires_on: input.noExpiry ? null : input.expiresOn, no_expiry: input.noExpiry,
    }).select('id').single()
    fail(versionError)
    versionId = str(version!.id)
    fail((await supabaseAdmin.from('safety_certificates').update({ current_version_id: versionId }).eq('id', certificate.id)).error)
  } catch (error) {
    if (versionId) await supabaseAdmin.from('safety_certificate_versions').delete().eq('id', versionId)
    await supabaseAdmin.from('safety_certificates').delete().eq('id', certificate.id)
    throw error
  }
  audit(actor.id, 'safety_task.certificate.create', certificate.id, input)
  return certificate.id as string
}

export async function replaceSafetyCertificateVersion(certificateId: string, input: CertificateInput, file: { key: string; fileName: string; contentType: string; sizeBytes: number }, actor: Actor) {
  const { data: certificate, error } = await supabaseAdmin.from('safety_certificates').select('id').eq('id', certificateId).eq('active', true).single()
  fail(error)
  if (!certificate) throw new Error('Certificate not found')
  const { data: version, error: versionError } = await supabaseAdmin.from('safety_certificate_versions').insert({
    certificate_id: certificateId, r2_key: file.key, file_name: file.fileName, content_type: file.contentType,
    size_bytes: file.sizeBytes, uploaded_by: actor.id, certificate_type: input.certificateType.trim(),
    document_no: input.documentNo?.trim() || null, holder_name: input.holderName.trim(), department: input.department?.trim() || null,
    issued_on: input.issuedOn, expires_on: input.noExpiry ? null : input.expiresOn, no_expiry: input.noExpiry,
  }).select('id').single()
  fail(versionError)
  const { error: updateError } = await supabaseAdmin.from('safety_certificates').update({
    current_version_id: version!.id, certificate_type: input.certificateType.trim(), document_no: input.documentNo?.trim() || null,
    holder_name: input.holderName.trim(), department: input.department?.trim() || null, issued_on: input.issuedOn,
    expires_on: input.noExpiry ? null : input.expiresOn, no_expiry: input.noExpiry, owner_id: input.ownerId,
    updated_by: actor.id, updated_at: new Date().toISOString(),
  }).eq('id', certificateId)
  if (updateError) {
    await supabaseAdmin.from('safety_certificate_versions').delete().eq('id', version!.id)
    fail(updateError)
  }
  audit(actor.id, 'safety_task.certificate.replace', certificateId, { versionId: version!.id, fileName: file.fileName })
  return version!.id as string
}

export async function archiveSafetyCertificate(certificateId: string, actor: Actor) {
  const { data, error } = await supabaseAdmin.from('safety_certificates').update({ active: false, updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', certificateId).eq('active', true).select('id').maybeSingle()
  fail(error)
  if (!data) throw new Error('Certificate not found')
  audit(actor.id, 'safety_task.certificate.archive', certificateId, {})
}

function latestInspectionEvidenceRows(rows: Row[]) {
  const latestByAsset = new Map<string, Row>()
  for (const row of rows) {
    const assetKey = str(row.asset_id) || str(row.id)
    const current = latestByAsset.get(assetKey)
    if (!current) {
      latestByAsset.set(assetKey, row)
      continue
    }
    const candidateDate = str(row.inspected_on)
    const currentDate = str(current.inspected_on)
    const candidateIsRoundLinked = row.round_item_id ? 1 : 0
    const currentIsRoundLinked = current.round_item_id ? 1 : 0
    const candidateIsNewer = candidateDate > currentDate
      || (candidateDate === currentDate && candidateIsRoundLinked > currentIsRoundLinked)
      || (candidateDate === currentDate && candidateIsRoundLinked === currentIsRoundLinked
        && `${str(row.created_at)}|${str(row.id)}` > `${str(current.created_at)}|${str(current.id)}`)
    if (candidateIsNewer) latestByAsset.set(assetKey, row)
  }
  return [...latestByAsset.values()]
}

export async function listSafetyEvidence(fiscalYear?: number) {
  let query = supabaseAdmin.from('quality_task_attachments').select('*, quality_task_instances!inner(id,period_end,period_label,quality_task_templates!inner(title,reference_code,workstream))')
    .eq('quality_task_instances.quality_task_templates.workstream', 'safety').order('uploaded_at', { ascending: false })
  if (fiscalYear) {
    const gregorianEndYear = fiscalYear - 543
    query = query.gte('quality_task_instances.period_end', `${gregorianEndYear - 1}-10-01`).lte('quality_task_instances.period_end', `${gregorianEndYear}-09-30`)
  }
  let inspectionQuery = supabaseAdmin.from('lab_map_safety_inspections')
    .select('id,photo_r2_key,photo_file_name,photo_content_type,photo_size_bytes,inspected_on,created_at,round_item_id,asset_id')
    .not('photo_r2_key', 'is', null)
    .not('photo_file_name', 'is', null)
    .is('superseded_at', null)
    .order('created_at', { ascending: false })
  if (fiscalYear) {
    const gregorianEndYear = fiscalYear - 543
    inspectionQuery = inspectionQuery.gte('inspected_on', `${gregorianEndYear - 1}-10-01`).lte('inspected_on', `${gregorianEndYear}-09-30`)
  }
  const [{ data, error }, { data: inspectionRows, error: inspectionError }] = await Promise.all([query, inspectionQuery])
  fail(error); fail(inspectionError)
  const taskEvidence = ((data ?? []) as Row[]).map(row => {
    const instance = row.quality_task_instances as Row
    const template = instance.quality_task_templates as Row
    return {
      id: str(row.id), instanceId: str(row.instance_id), sourceKind: 'task' as const, downloadHref: `/api/admin/safety-tasks/attachments/${str(row.id)}`,
      fileName: str(row.file_name), contentType: str(row.content_type),
      sizeBytes: Number(row.size_bytes), uploadedAt: str(row.uploaded_at), requirementId: nullable(row.requirement_id),
      evidenceKind: str(row.evidence_kind) || 'document', taskTitle: str(template.title), referenceCode: nullable(template.reference_code),
      periodLabel: str(instance.period_label), fiscalYear: fiscalYearForDate(str(instance.period_end)),
      assetKind: null, assetCode: null, assetName: null, taskSourceKey: null, inspectedOn: null,
    }
  })
  const inspections = latestInspectionEvidenceRows((inspectionRows ?? []) as Row[])
  if (!inspections.length) return taskEvidence

  const roundItemIds = [...new Set(inspections.map(row => nullable(row.round_item_id)).filter((id): id is string => Boolean(id)))]
  const assetIds = [...new Set(inspections.map(row => str(row.asset_id)).filter(Boolean))]
  const [{ data: roundItems, error: roundItemError }, { data: assets, error: assetError }] = await Promise.all([
    roundItemIds.length ? supabaseAdmin.from('lab_map_safety_inspection_round_items').select('id,round_id').in('id', roundItemIds) : Promise.resolve({ data: [], error: null }),
    assetIds.length ? supabaseAdmin.from('lab_map_safety_assets').select('id,name_th,code,kind').in('id', assetIds) : Promise.resolve({ data: [], error: null }),
  ])
  fail(roundItemError); fail(assetError)
  const roundIdByItem = new Map(((roundItems ?? []) as Row[]).map(row => [str(row.id), str(row.round_id)]))
  const roundIds = [...new Set([...roundIdByItem.values()].filter(Boolean))]
  const { data: links, error: linkError } = roundIds.length
    ? await supabaseAdmin.from('quality_task_links').select('source_id,instance_id').eq('integration_kind', 'safety_inspection').eq('source_type', 'lab_map_safety_inspection_round').in('source_id', roundIds)
    : { data: [], error: null }
  fail(linkError)
  const linkByRound = new Map(((links ?? []) as Row[]).map(row => [str(row.source_id), row]))
  const instanceIds = [...new Set(((links ?? []) as Row[]).map(row => str(row.instance_id)).filter(Boolean))]
  const { data: linkedInstances, error: instanceError } = instanceIds.length
    ? await supabaseAdmin.from('quality_task_instances').select('id,period_label,period_end,quality_task_templates!inner(title,reference_code,workstream)').eq('quality_task_templates.workstream', 'safety').in('id', instanceIds)
    : { data: [], error: null }
  fail(instanceError)
  const instanceById = new Map(((linkedInstances ?? []) as Row[]).map(row => [str(row.id), row]))
  const assetById = new Map(((assets ?? []) as Row[]).map(row => [str(row.id), row]))
  const taskKeys = new Set(((data ?? []) as Row[]).map(row => str(row.r2_key)))
  const inspectionEvidence = inspections.filter(row => !taskKeys.has(str(row.photo_r2_key))).map(row => {
    const inspectionId = str(row.id)
    const roundId = roundIdByItem.get(str(row.round_item_id))
    const link = roundId ? linkByRound.get(roundId) : undefined
    const instance = link ? instanceById.get(str(link.instance_id)) : undefined
    const template = instance?.quality_task_templates as Row | undefined
    const asset = assetById.get(str(row.asset_id))
    const inspectedOn = str(row.inspected_on)
    const assetKind = nullable(asset?.kind)
    return {
      id: `inspection-${inspectionId}`, instanceId: instance ? str(instance.id) : null, sourceKind: 'inspection' as const,
      downloadHref: `/api/admin/lab-map/safety-inspections/${inspectionId}/photo`, fileName: str(row.photo_file_name),
      contentType: str(row.photo_content_type), sizeBytes: Number(row.photo_size_bytes ?? 0), uploadedAt: str(row.created_at),
      requirementId: null, evidenceKind: 'inspection-photo',
      taskTitle: str(asset?.name_th) || (template ? str(template.title) : `รูปตรวจ${str(asset?.code) || 'อุปกรณ์ความปลอดภัย'}`),
      referenceCode: template ? nullable(template.reference_code) : 'LAB-MAP-SAFETY',
      periodLabel: instance ? str(instance.period_label) : `ตรวจ ${inspectedOn}`,
      fiscalYear: fiscalYearForDate(inspectedOn),
      assetKind, assetCode: nullable(asset?.code), assetName: nullable(asset?.name_th),
      taskSourceKey: inspectionSourceKeyForAssetKind(assetKind), inspectedOn,
    }
  })
  return [...taskEvidence, ...inspectionEvidence].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
}

export async function getSafetyTaskIntegrations(instanceId: string, level: PermLevel) {
  await getOccurrenceReadAccess(instanceId, level, 'safety')
  const { data: links, error } = await supabaseAdmin.from('quality_task_links').select('*').eq('instance_id', instanceId).order('created_at')
  fail(error)
  const result: Row[] = []
  for (const link of (links ?? []) as Row[]) {
    if (str(link.integration_kind) !== 'safety_inspection') {
      result.push({ id: str(link.id), kind: str(link.integration_kind), sourceId: str(link.source_id), syncStatus: str(link.sync_status), metadata: link.metadata ?? {} })
      continue
    }
    const { data: items, error: itemError } = await supabaseAdmin.from('lab_map_safety_inspection_round_items')
      .select('status,inspection_id,asset:lab_map_safety_assets(code,name_th,kind),inspection:lab_map_safety_inspections!lab_map_safety_inspection_round_items_inspection_id_fkey(id,result,inspected_on,note,photo_file_name)')
      .eq('round_id', link.source_id).order('sequence_no')
    fail(itemError)
    result.push({
      id: str(link.id), kind: 'safety_inspection', sourceId: str(link.source_id), syncStatus: str(link.sync_status),
      metadata: link.metadata ?? {}, items: (items ?? []).map((item: Row) => ({
        status: str(item.status), inspectionId: nullable(item.inspection_id), asset: item.asset ?? null,
        inspection: item.inspection ?? null,
      })),
    })
  }
  return result
}

const INSPECTION_KINDS: Record<string, string[]> = {
  'CBH-ST-01': ['eyewash', 'emergency-shower'],
  'CBH-ST-03': ['fire-extinguisher', 'fire-hose'],
  'CBH-ST-04': ['spill-kit'],
  'CBH-ST-19': ['spill-kit'],
  'CBH-ST-26': ['nss-eyewash'],
}

function inspectionSourceKeyForAssetKind(kind: string | null) {
  if (!kind) return null
  return Object.entries(INSPECTION_KINDS).find(([, kinds]) => kinds.includes(kind))?.[0] ?? null
}

export async function openSafetyInspectionRoundFromTask(instanceId: string, actor: Actor, level: PermLevel) {
  const access = await getOccurrenceAccess(instanceId, actor, level, 'safety')
  if (level !== 'edit') throw new Error('Forbidden')
  if (str(access.template.integration_kind) !== 'safety_inspection') throw new Error('งานนี้ไม่ได้เชื่อมกับ Inspection Round')
  const { data: existing, error: existingError } = await supabaseAdmin.from('quality_task_links').select('source_id')
    .eq('instance_id', instanceId).eq('integration_kind', 'safety_inspection').eq('source_type', 'lab_map_safety_inspection_round').maybeSingle()
  fail(existingError)
  if (existing) return { roundId: str(existing.source_id), reused: true }
  const { data: template, error: templateError } = await supabaseAdmin.from('quality_task_templates').select('source_key,title').eq('id', access.instance.template_id).single()
  fail(templateError)
  const kinds = INSPECTION_KINDS[str(template!.source_key)]
  let assetQuery = supabaseAdmin.from('lab_map_safety_assets').select('id,kind,inspection_profile').eq('lifecycle_status', 'active').order('code')
  if (kinds?.length) assetQuery = assetQuery.in('kind', kinds)
  const { data: assets, error: assetError } = await assetQuery
  fail(assetError)
  if (!(assets ?? []).length) throw new Error('ไม่พบอุปกรณ์ที่เปิดใช้งานสำหรับรอบตรวจนี้')
  const profiles = [...new Set((assets ?? []).map((asset: Row) => str(asset.inspection_profile)).filter(Boolean))]
  const formTemplateByProfile = new Map<string, string>()
  if (profiles.length) {
    const { data: formTemplates, error: formTemplateError } = await supabaseAdmin.from('lab_map_safety_form_templates')
      .select('id,profile,version').in('profile', profiles).eq('active', true).order('version', { ascending: false })
    fail(formTemplateError)
    for (const formTemplate of (formTemplates ?? []) as Row[]) {
      const profile = str(formTemplate.profile)
      if (profile && !formTemplateByProfile.has(profile)) formTemplateByProfile.set(profile, str(formTemplate.id))
    }
  }
  const dueOn = nullable(access.instance.planned_date) ?? nullable(access.instance.period_end)
  const { data: round, error: roundError } = await supabaseAdmin.from('lab_map_safety_inspection_rounds').insert({
    name_th: `${str(template!.title)} — ${bangkokToday()}`, filter_snapshot: {
      query: '', status: '', kind: '', spaceCode: '', source: 'safety_task', kinds: kinds ?? [],
      taskInstanceId: instanceId, templateId: access.instance.template_id,
      periodStart: access.instance.period_start, periodEnd: access.instance.period_end, dueOn,
    }, started_by: actor.id,
  }).select('id').single()
  fail(roundError)
  try {
    fail((await supabaseAdmin.from('lab_map_safety_inspection_round_items').insert((assets ?? []).map((asset: Row, index: number) => ({
      round_id: round!.id, asset_id: asset.id, sequence_no: index + 1,
      task_instance_id: instanceId, template_id: formTemplateByProfile.get(str(asset.inspection_profile)) ?? null, due_on: dueOn,
    })))).error)
    const { error: linkError } = await supabaseAdmin.from('quality_task_links').insert({
      instance_id: instanceId, integration_kind: 'safety_inspection', source_type: 'lab_map_safety_inspection_round',
      source_id: round!.id, sync_status: 'pending', created_by: actor.id,
    })
    if (linkError && isUniqueViolation(linkError)) {
      const { data: raced, error: racedError } = await supabaseAdmin.from('quality_task_links').select('source_id')
        .eq('instance_id', instanceId).eq('integration_kind', 'safety_inspection').eq('source_type', 'lab_map_safety_inspection_round').maybeSingle()
      fail(racedError)
      if (raced) {
        await supabaseAdmin.from('lab_map_safety_inspection_round_items').delete().eq('round_id', round!.id)
        await supabaseAdmin.from('lab_map_safety_inspection_rounds').delete().eq('id', round!.id)
        return { roundId: str(raced.source_id), reused: true }
      }
    }
    fail(linkError)
    fail((await supabaseAdmin.from('quality_task_instances').update({ status: 'in_progress', updated_by: actor.id, updated_at: new Date().toISOString() }).eq('id', instanceId)).error)
  } catch (error) {
    await supabaseAdmin.from('lab_map_safety_inspection_round_items').delete().eq('round_id', round!.id)
    await supabaseAdmin.from('lab_map_safety_inspection_rounds').delete().eq('id', round!.id)
    throw error
  }
  audit(actor.id, 'safety_task.inspection_round.open', instanceId, { roundId: round!.id })
  return { roundId: str(round!.id), reused: false }
}

export async function syncSafetyInspectionRoundToTask(roundId: string, actor: Actor) {
  const { data: link, error: linkError } = await supabaseAdmin.from('quality_task_links').select('*')
    .eq('integration_kind', 'safety_inspection').eq('source_type', 'lab_map_safety_inspection_round').eq('source_id', roundId).maybeSingle()
  fail(linkError)
  if (!link) return { linked: false as const }
  if (str(link.sync_status) === 'synced') return { linked: true as const, instanceId: str(link.instance_id), status: 'synced' as const, metadata: link.metadata ?? {} }
  try {
    const [{ data: instance, error: instanceError }, { data: items, error: itemError }] = await Promise.all([
      supabaseAdmin.from('quality_task_instances').select('id,quality_task_templates!inner(approval_mode,workstream)').eq('id', link.instance_id).eq('quality_task_templates.workstream', 'safety').single(),
      supabaseAdmin.from('lab_map_safety_inspection_round_items').select('status,inspection_id,inspection:lab_map_safety_inspections!lab_map_safety_inspection_round_items_inspection_id_fkey(id,result,note,photo_r2_key)').eq('round_id', roundId),
    ])
    fail(instanceError); fail(itemError)
    const rows = (items ?? []) as Row[]
    const inspections = rows.map(row => row.inspection as Row | null).filter(Boolean) as Row[]
    const abnormal = inspections.filter(row => str(row.result) !== 'passed')
    const metadata = {
      total: rows.length, completed: rows.filter(row => str(row.status) === 'completed').length,
      skipped: rows.filter(row => str(row.status) === 'skipped').length, abnormal: abnormal.length,
      inspectionIds: rows.map(row => nullable(row.inspection_id)).filter(Boolean), photoCount: inspections.filter(row => row.photo_r2_key).length,
    }
    const template = instance!.quality_task_templates as Row
    const requiresReview = str(template.approval_mode) === 'required'
    const now = new Date().toISOString()
    fail((await supabaseAdmin.from('quality_task_instances').update({
      status: requiresReview ? 'pending_review' : 'completed', submitted_by: actor.id, submitted_at: now,
      completed_by: requiresReview ? null : actor.id, completed_at: requiresReview ? null : now,
      completion_note: `Inspection Round: ตรวจ ${metadata.completed}/${metadata.total} รายการ, ผิดปกติ ${metadata.abnormal}`,
      updated_by: actor.id, updated_at: now,
    }).eq('id', link.instance_id)).error)
    const capaDue = new Date(now); capaDue.setUTCDate(capaDue.getUTCDate() + 30)
    for (const inspection of abnormal) {
      const inspectionId = str(inspection.id)
      if (!inspectionId) continue
      fail((await supabaseAdmin.from('quality_task_action_items').upsert({
        instance_id: link.instance_id, user_id: actor.id, manual_name: null,
        description: `แก้ไขข้อบกพร่องจาก Inspection: ${str(inspection.result)}${inspection.note ? ` — ${str(inspection.note)}` : ''}`,
        due_date: capaDue.toISOString().slice(0, 10), source_type: 'safety_inspection', source_id: inspectionId,
        created_by: actor.id, updated_at: now,
      }, { onConflict: 'instance_id,source_type,source_id' })).error)
    }
    fail((await supabaseAdmin.from('quality_task_links').update({ sync_status: 'synced', sync_error: null, metadata, updated_at: now }).eq('id', link.id)).error)
    fail((await supabaseAdmin.from('quality_task_reviews').insert({
      instance_id: link.instance_id, action: 'submitted', actor_id: actor.id,
      note: `Inspection Round ${roundId}: ${metadata.completed}/${metadata.total} รายการ`, created_at: now,
    })).error)
    audit(actor.id, 'safety_task.inspection_round.sync', str(link.instance_id), { roundId, ...metadata })
    return { linked: true as const, instanceId: str(link.instance_id), status: requiresReview ? 'pending_review' as const : 'completed' as const, metadata }
  } catch (error) {
    await supabaseAdmin.from('quality_task_links').update({ sync_status: 'pending', sync_error: error instanceof Error ? error.message : 'Sync failed', updated_at: new Date().toISOString() }).eq('id', link.id)
    throw error
  }
}
