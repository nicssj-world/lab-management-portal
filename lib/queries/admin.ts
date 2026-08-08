import type { SupabaseClient } from '@supabase/supabase-js'
import type { Profile, AuditLog } from '@/lib/supabase/types'

export async function getProfiles(supabase: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function updateProfile(
  supabase: SupabaseClient,
  id: string,
  updates: Partial<Pick<Profile, 'name' | 'role' | 'dept' | 'status'>>
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export type AuditLogWithUser = AuditLog & { user_name: string | null }

// Actions that represent actual DB mutations written to audit_log
const CRUD_ACTIONS = [
  'test.create', 'test.update', 'test.delete', 'test.bulk_delete',
  'test.import', 'test.duplicate', 'test.purge_deleted',
  'create_news', 'update_news', 'delete_news', 'line_broadcast_news',
  'phleb_upload_init',
  'delete',
  'document.upload', 'document.import_current', 'document.edit', 'document.delete', 'document.delete_set',
  'document.status_change', 'document.current_revision_rollback',
  'document.revision_draft_create', 'document.revision_draft_status', 'document.revision_draft_publish',
  'document.revision_draft_publish_existing_cover',
  'document.revision_history_backfill_create', 'document.revision_history_backfill_update',
  'document.revision_history_backfill_delete', 'document.revision_history_date_update',
  'document.review_confirmed', 'document.annual_review', 'document.obsolete_stamp', 'document.footer_stamp',
  'document.read_audience_bulk', 'document.official_confirm', 'document.ephemeral_purge_retry',
  'manual_edit',
  'document_profile.update', 'document_profile.update_self',
  'document_profile.signature_upload', 'document_profile.signature_upload_self',
  'document_profile.signature_delete', 'document_profile.signature_delete_self',
  'equipment.create', 'equipment.update', 'equipment.delete', 'equipment.permission.update',
  'equipment.area.create', 'equipment.area.update', 'equipment.survey_round.open', 'equipment.survey_round.close',
  'equipment.pm_cal.plan.replace', 'equipment.pm_cal.result.create', 'equipment.pm_cal.result.update',
  'equipment.pm_cal.result.delete', 'equipment.pm_cal.certificate.attach', 'equipment.pm_cal.certificate.delete',
  'equipment.pm_cal.group.create', 'equipment.pm_cal.group.update', 'equipment.pm_cal.group.cancel',
  'contract.create', 'contract.update', 'contract.delete', 'contract.usage_add',
  'risk.create', 'risk.update', 'risk.delete', 'risk.close', 'risk.attachment.upload', 'risk.attachment.delete',
  'rejection.create', 'smart_rm.import',
  'register.create', 'register.update', 'register.delete', 'register.review', 'register.residual',
  'register.close', 'register.action.create',
  'incident.report', 'incident.review', 'incident.update', 'incident.delete', 'incident.close',
  'incident.escalate', 'incident.action.create',
  'lab_map.person_assignment.create', 'lab_map.person_assignment.update', 'lab_map.person_assignment.delete',
  'lab_map.release.create', 'lab_map.release.update', 'lab_map.release.publish',
  'lab_map.safety_asset.create', 'lab_map.safety_asset.update', 'lab_map.safety_asset.retire',
  'lab_map.safety_inspection.create', 'lab_map.safety_inspection_round.close',
  'lab_map.assembly_point.create', 'lab_map.assembly_point.update', 'lab_map.assembly_point.retire',
  'lab_map.assembly_verification.create', 'lab_map.safety_editor.grant', 'lab_map.safety_editor.revoke',
  'chemical_safety.sds.create_draft', 'chemical_safety.sds.upload_file', 'chemical_safety.sds.delete_draft',
  'chemical_safety.department_sds.upload', 'chemical_safety.department_sds.rename',
  'chemical_safety.department_sds.delete', 'chemical_safety.department_sds.replace_file',
  'chemical_safety.department_sds.publish', 'chemical_safety.registry.export_pdf', 'chemical_safety.registry.export_excel',
  'chemical_safety.role_scope.grant', 'chemical_safety.role_scope.revoke', 'chemical_safety.import.prepared',
  'kpi.entry', 'kpi.settings', 'kpi.definition.create', 'kpi.definition.update', 'kpi.definition.delete',
  'quality_task.instance.create', 'quality_task.instance.materialize', 'quality_task.instance.schedule',
  'quality_task.instance.complete', 'quality_task.instance.reopen', 'quality_task.instance.cancel',
  'quality_task.instance.delete',
  'quality_task.template.create', 'quality_task.template.update', 'quality_task.template.delete',
  'quality_task.attachment.upload', 'quality_task.attachment.delete', 'quality_task.check_in',
  'satisfaction.report.export', 'satisfaction.comments.export', 'satisfaction.kpi.publish', 'satisfaction.draft.discard',
  'satisfaction_editors.grant', 'satisfaction_editors.revoke',
  'eqa.provider.create', 'eqa.provider.update', 'eqa.provider.deactivate',
  'eqa.program.create', 'eqa.program.update', 'eqa.program.deactivate',
  'eqa.program_test.create', 'eqa.program_test.update', 'eqa.program_test.deactivate', 'eqa.coverage.upsert',
  'eqa.round.create', 'eqa.round.update', 'eqa.round.close', 'eqa.round.delete',
  'eqa.result.upsert', 'eqa.result.delete',
  'eqa.capa.create', 'eqa.capa.update', 'eqa.capa.delete',
  'eqa.attachment.upload', 'eqa.attachment.delete', 'eqa.editor.update',
  'outlab.laboratory.create', 'outlab.laboratory.update', 'outlab.laboratory.deactivate',
  'outlab.service.create', 'outlab.service.update', 'outlab.service.deactivate', 'outlab.service.bulk_import',
  'outlab.certificate.create', 'outlab.certificate.update', 'outlab.certificate.revoke', 'outlab.certificate.purge',
  'outlab.attachment.upload', 'outlab.attachment.delete', 'outlab.editor.update',
  'it_access.create', 'it_access.update', 'it_access.delete', 'it_access.review', 'it_access.review_approve',
  'it_system.create', 'it_system.update', 'it_editors.grant', 'it_editors.revoke',
  'it_downtime.create', 'it_downtime.update', 'it_downtime.delete',
  'it_backup.create', 'it_backup.update', 'it_backup.delete',
  'it_visitor.checkout', 'it_visitor.self_checkout', 'it_visitor.update', 'it_visitor.delete',
  'it_visitor.settings', 'it_visitor.rotate_token',
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
  'head_contact.status_update', 'head_contact.action_note_update', 'head_contact.contact_logged',
  'head_contact.delete', 'head_contact.settings', 'head_contact.rotate_token',
  'head_contact.unit_create', 'head_contact.unit_update',
  'manual_publish',
  'public_section_create', 'public_section_update', 'public_section_delete', 'public_section_reorder',
  'public_section_items', 'public_section_upload', 'public_section_upload_delete',
]

export async function getAuditLog(supabase: SupabaseClient, limit = 100): Promise<AuditLogWithUser[]> {
  // Fetch extra rows to account for Admin entries that will be filtered out in memory
  const { data: logs, error } = await supabase
    .from('audit_log')
    .select('*')
    .in('action', CRUD_ACTIONS)
    .order('created_at', { ascending: false })
    .limit(limit * 4)
  if (error) throw error
  if (!logs?.length) return []

  const userIds = [...new Set(logs.map((l) => l.user_id).filter(Boolean))]
  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('id', userIds)

  const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))

  return logs
    .slice(0, limit)
    .map((log) => ({
      ...log,
      user_name: profileMap.get(log.user_id)?.name ?? null,
    }))
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  entry: { action: string; user_id?: string; target?: string; detail?: string }
): Promise<void> {
  await supabase.from('audit_log').insert(entry)
}
