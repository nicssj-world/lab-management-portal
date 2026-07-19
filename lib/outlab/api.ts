import { supabaseAdmin } from '@/lib/supabase/admin'
import type { LaboratoryInput, OutlabCertificateInput, OutlabServiceInput } from './schemas'
import { isOutlabCatalogTest } from './domain'

export async function assertOutlabCatalogTest(testId: number | null) {
  if (testId == null) return
  const { data, error } = await supabaseAdmin.from('tests').select('category_id, department').eq('id', testId).eq('active', true).maybeSingle()
  if (error) throw error
  if (!data || !isOutlabCatalogTest(data)) throw new Error('เลือกได้เฉพาะรายการ Catalog ของงานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ')
}

export function laboratoryPayload(input: LaboratoryInput, actorId: string) {
  return {
    sector: input.sector, name: input.name, brand: input.brand, address: input.address,
    contact_name: input.contactName, contact_phone: input.contactPhone, contact_email: input.contactEmail,
    public_accreditation_summary: input.publicAccreditationSummary, active: input.active,
    publish_public: input.publishPublic, remark: input.remark, updated_at: new Date().toISOString(), updated_by: actorId,
  }
}

export function servicePayload(input: OutlabServiceInput, actorId: string) {
  return {
    laboratory_id: input.laboratoryId, test_id: input.testId, manual_test_name: input.manualTestName,
    test_name_snapshot: input.testNameSnapshot, external_code: input.externalCode, method: input.method,
    specimen: input.specimen, transport_condition: input.transportCondition, tat_text: input.tatText,
    price: input.price, is_primary: input.isPrimary, active: input.active, remark: input.remark,
    updated_at: new Date().toISOString(), updated_by: actorId,
  }
}

export function certificatePayload(input: OutlabCertificateInput, actorId: string) {
  return {
    laboratory_id: input.laboratoryId, standard_name: input.standardName,
    accreditation_body: input.accreditationBody, certificate_no: input.certificateNo, scope: input.scope,
    valid_from: input.validFrom, expires_on: input.expiresOn, lifecycle: input.lifecycle,
    supersedes_id: input.supersedesId, remark: input.remark,
    updated_at: new Date().toISOString(), updated_by: actorId,
  }
}

export async function syncLaboratoryOwners(laboratoryId: string, input: LaboratoryInput) {
  const ownerIds = Array.from(new Set([...input.ownerIds, ...(input.primaryOwnerId ? [input.primaryOwnerId] : [])]))
  const { error: deleteError } = await supabaseAdmin.from('outlab_laboratory_owners').delete().eq('laboratory_id', laboratoryId)
  if (deleteError) throw deleteError
  if (!ownerIds.length) return
  const { error } = await supabaseAdmin.from('outlab_laboratory_owners').insert(ownerIds.map(userId => ({
    laboratory_id: laboratoryId,
    user_id: userId,
    owner_role: userId === input.primaryOwnerId ? 'primary' : 'collaborator',
  })))
  if (error) throw error
}
