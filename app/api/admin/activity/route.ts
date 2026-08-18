import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getRolePermissions } from '@/lib/permissions'
import { isAdminRole } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

const EXCLUDED = ['permission.update', 'settings.update', 'user.update', 'user.create', 'document.cover_generate', 'document.cover_regenerate']

const CATEGORY_ACTIONS: Record<string, string[]> = {
  document: [
    'document.upload', 'document.import_current', 'document.edit', 'document.delete', 'document.delete_set',
    'document.status_change', 'document.current_revision_rollback',
    'document.revision_draft_create', 'document.revision_draft_status', 'document.revision_draft_publish',
    'document.revision_draft_publish_existing_cover',
    'document.revision_history_backfill_create', 'document.revision_history_backfill_update',
    'document.revision_history_backfill_delete', 'document.revision_history_date_update',
    'document.review_confirmed', 'document.annual_review', 'document.obsolete_stamp', 'document.footer_stamp',
    'document.read_audience_bulk', 'document.official_confirm', 'document.ephemeral_purge_retry',
    'delete', 'manual_edit', 'manual_publish',
    'document_profile.update', 'document_profile.update_self',
    'document_profile.signature_upload', 'document_profile.signature_upload_self',
    'document_profile.signature_delete', 'document_profile.signature_delete_self',
    'public_section_create', 'public_section_update', 'public_section_delete', 'public_section_reorder',
    'public_section_items', 'public_section_upload', 'public_section_upload_delete',
  ],
  test:     ['test.create', 'test.update', 'test.delete', 'test.bulk_delete', 'test.import', 'test.duplicate', 'test.purge_deleted'],
  equipment:[
    'equipment.create', 'equipment.update', 'equipment.delete', 'equipment.permission.update',
    'equipment.area.create', 'equipment.area.update', 'equipment.survey_round.open', 'equipment.survey_round.close',
    'equipment.pm_cal.plan.replace', 'equipment.pm_cal.result.create', 'equipment.pm_cal.result.update',
    'equipment.pm_cal.result.delete', 'equipment.pm_cal.certificate.attach', 'equipment.pm_cal.certificate.delete',
    'equipment.pm_cal.group.create', 'equipment.pm_cal.group.update', 'equipment.pm_cal.group.cancel',
  ],
  contract: ['contract.create', 'contract.update', 'contract.delete', 'contract.usage_add'],
  risk: [
    'risk.create', 'risk.update', 'risk.delete', 'risk.close', 'risk.attachment.upload', 'risk.attachment.delete',
    'rejection.create', 'smart_rm.import',
    'register.create', 'register.update', 'register.delete', 'register.review', 'register.residual',
    'register.close', 'register.action.create',
    'incident.report', 'incident.review', 'incident.update', 'incident.delete', 'incident.close',
    'incident.escalate', 'incident.action.create',
  ],
  safety: [
    'lab_map.person_assignment.create', 'lab_map.person_assignment.update', 'lab_map.person_assignment.delete',
    'lab_map.release.create', 'lab_map.release.update', 'lab_map.release.publish',
    'lab_map.safety_asset.create', 'lab_map.safety_asset.update', 'lab_map.safety_asset.retire',
    'lab_map.safety_inspection.create', 'lab_map.safety_inspection.reuse', 'lab_map.safety_inspection.expiry_correction', 'lab_map.safety_inspection_round.close',
    'lab_map.assembly_point.create', 'lab_map.assembly_point.update', 'lab_map.assembly_point.retire',
    'lab_map.assembly_verification.create', 'lab_map.safety_editor.grant', 'lab_map.safety_editor.revoke',
    'chemical_safety.sds.create_draft', 'chemical_safety.sds.upload_file', 'chemical_safety.sds.delete_draft',
    'chemical_safety.department_sds.upload', 'chemical_safety.department_sds.rename',
    'chemical_safety.department_sds.delete', 'chemical_safety.department_sds.replace_file',
    'chemical_safety.department_sds.publish', 'chemical_safety.registry.export_pdf', 'chemical_safety.registry.export_excel',
    'chemical_safety.role_scope.grant', 'chemical_safety.role_scope.revoke', 'chemical_safety.import.prepared',
  ],
  kpi:      ['kpi.entry', 'kpi.settings', 'kpi.definition.create', 'kpi.definition.update', 'kpi.definition.delete'],
  news:     ['create_news', 'update_news', 'delete_news', 'line_broadcast_news'],
  quality_task: [
    'quality_task.instance.create', 'quality_task.instance.materialize', 'quality_task.instance.schedule',
    'quality_task.instance.complete', 'quality_task.instance.reopen', 'quality_task.instance.cancel',
    'quality_task.instance.delete',
    'quality_task.template.create', 'quality_task.template.update', 'quality_task.template.delete',
    'quality_task.attachment.upload', 'quality_task.attachment.delete', 'quality_task.check_in',
  ],
  satisfaction: [
    'satisfaction.report.export', 'satisfaction.comments.export', 'satisfaction.kpi.publish', 'satisfaction.draft.discard',
    'satisfaction_editors.grant', 'satisfaction_editors.revoke',
  ],
  eqa: [
    'eqa.provider.create', 'eqa.provider.update', 'eqa.provider.deactivate',
    'eqa.program.create', 'eqa.program.update', 'eqa.program.deactivate',
    'eqa.program_test.create', 'eqa.program_test.update', 'eqa.program_test.deactivate', 'eqa.coverage.upsert',
    'eqa.round.create', 'eqa.round.update', 'eqa.round.close', 'eqa.round.delete',
    'eqa.result.upsert', 'eqa.result.delete',
    'eqa.capa.create', 'eqa.capa.update', 'eqa.capa.delete',
    'eqa.attachment.upload', 'eqa.attachment.delete', 'eqa.editor.update',
  ],
  outlab: [
    'outlab.laboratory.create', 'outlab.laboratory.update', 'outlab.laboratory.deactivate',
    'outlab.service.create', 'outlab.service.update', 'outlab.service.deactivate', 'outlab.service.bulk_import',
    'outlab.certificate.create', 'outlab.certificate.update', 'outlab.certificate.revoke', 'outlab.certificate.purge',
    'outlab.attachment.upload', 'outlab.attachment.delete', 'outlab.editor.update',
  ],
  it: [
    'it_access.create', 'it_access.update', 'it_access.delete', 'it_access.review', 'it_access.review_approve',
    'it_system.create', 'it_system.update', 'it_editors.grant', 'it_editors.revoke',
    'it_downtime.create', 'it_downtime.update', 'it_downtime.delete',
    'it_backup.create', 'it_backup.update', 'it_backup.delete',
  ],
  it_visitor: [
    'it_visitor.checkout', 'it_visitor.self_checkout', 'it_visitor.update', 'it_visitor.delete',
    'it_visitor.settings', 'it_visitor.rotate_token',
  ],
  personnel: [
    'personnel.profile.update', 'personnel.org.create', 'personnel.org.delete',
    'personnel.jd.create', 'personnel.jd.update',
    'personnel.staff_competencies.create', 'personnel.staff_competencies.update', 'personnel.staff_competencies.delete',
    'personnel.competency_signoff',
    'personnel.staff_training.create', 'personnel.staff_training.update', 'personnel.staff_training.delete',
    'personnel.staff_training_plan.create', 'personnel.staff_training_plan.update', 'personnel.staff_training_plan.delete',
    'personnel.staff_certifications.create', 'personnel.staff_certifications.update', 'personnel.staff_certifications.delete',
    'personnel.staff_authorizations.create', 'personnel.staff_authorizations.update',
    'personnel.staff_authorizations.delete', 'personnel.staff_authorizations.batch_create',
    'personnel.dept_role.set', 'personnel.work_group.create',
    'personnel.bulk.authorizations', 'personnel.bulk.training-plan', 'personnel.bulk.competencies',
    'personnel.exam.create', 'personnel.exam.assign', 'personnel.training.his_import',
    'personnel.staff_health_records.create', 'personnel.staff_health_records.update', 'personnel.staff_health_records.delete',
    'personnel.staff_confidentiality_agreements.create', 'personnel.staff_confidentiality_agreements.update',
    'personnel.staff_confidentiality_agreements.delete',
    'personnel.agreements.campaign_create', 'personnel.agreements.campaign_delete',
    'personnel.agreements.campaign_auto_lock', 'personnel.agreements.submit',
    'personnel.agreements.exempt', 'personnel.agreements.certify_batch',
  ],
  head_contact: [
    'head_contact.status_update', 'head_contact.action_note_update', 'head_contact.contact_logged',
    'head_contact.delete', 'head_contact.settings', 'head_contact.rotate_token',
    'head_contact.unit_create', 'head_contact.unit_update',
  ],
}

async function getActor() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin.from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}

const PAGE_SIZE = 30

export async function GET(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = await getRolePermissions(actor.role)
  if ((perms['Activity Log'] ?? 'none') === 'none') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sp = req.nextUrl.searchParams
  const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
  const category = sp.get('category') ?? ''
  const from     = sp.get('from') ?? ''
  const to       = sp.get('to') ?? ''

  const excluded = `(${EXCLUDED.map(a => `"${a}"`).join(',')})`

  let query = supabaseAdmin
    .from('audit_log')
    .select('id, action, target, detail, created_at, user_id', { count: 'exact' })
    .not('action', 'in', excluded)
    .order('created_at', { ascending: false })

  if (category && CATEGORY_ACTIONS[category]) {
    query = query.in('action', CATEGORY_ACTIONS[category])
  }
  if (from) query = query.gte('created_at', from)
  if (to)   query = query.lte('created_at', to + 'T23:59:59.999Z')

  const fromIdx = (page - 1) * PAGE_SIZE
  const { data: logs, count, error } = await query.range(fromIdx, fromIdx + PAGE_SIZE - 1)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const userIds = [...new Set((logs ?? []).map(l => l.user_id).filter(Boolean))]
  let profileMap: Record<string, string> = {}
  if (userIds.length > 0) {
    const { data: profiles } = await supabaseAdmin.from('profiles').select('id, name').in('id', userIds)
    profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.name ?? '']))
  }

  return NextResponse.json({
    data: (logs ?? []).map(l => ({ ...l, user_name: profileMap[l.user_id] ?? null })),
    count: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
  })
}

export async function DELETE(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isAdminRole(actor.role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const ids: unknown[] = Array.isArray(body?.ids) ? body.ids : []
  if (ids.length === 0) return NextResponse.json({ error: 'No ids provided' }, { status: 400 })

  const { error } = await supabaseAdmin.from('audit_log').delete().in('id', ids)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: ids.length })
}
