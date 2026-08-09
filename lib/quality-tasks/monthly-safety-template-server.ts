import 'server-only'

import type { Actor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SafetyInspectionProfileKey } from './monthly-safety'

type Row = Record<string, any>
type TemplateItemInput = { itemKey: string; labelTh: string; expiryRequired: boolean; dateMode: 'none' | 'manufactured_or_packed' | 'purchased' }
const SPILL_PROFILES = new Set<SafetyInspectionProfileKey>(['biohazard_spill_kit', 'chemical_spill_kit'])

function rows(value: unknown): Row[] { return Array.isArray(value) ? value : [] }
function fail(error: { message?: string } | null | undefined) { if (error) throw new Error(error.message || 'Monthly template operation failed') }
async function audit(actorId: string, action: string, target: string, detail: unknown) {
  fail((await supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail: JSON.stringify(detail) })).error)
}

export async function listMonthlySafetyFormTemplates() {
  const { data: templates, error } = await supabaseAdmin.from('lab_map_safety_form_templates').select('*').order('profile').order('version', { ascending: false })
  fail(error)
  const ids = rows(templates).map(row => String(row.id))
  const { data: items, error: itemError } = ids.length
    ? await supabaseAdmin.from('lab_map_safety_form_template_items').select('*').in('template_id', ids).order('sort_order')
    : { data: [], error: null }
  fail(itemError)
  return rows(templates).map(template => ({
    id: String(template.id), profile: String(template.profile) as SafetyInspectionProfileKey,
    version: Number(template.version), titleTh: String(template.title_th), active: Boolean(template.active),
    photoRequired: Boolean(template.photo_required), createdAt: String(template.created_at), retiredAt: template.retired_at as string | null,
    items: rows(items).filter(item => item.template_id === template.id).map(item => ({
      id: String(item.id), itemKey: String(item.item_key), labelTh: String(item.label_th), sortOrder: Number(item.sort_order),
      expiryRequired: Boolean(item.expiry_required), dateMode: item.date_mode as TemplateItemInput['dateMode'],
    })),
  }))
}

export async function createMonthlySafetyFormTemplate(
  input: { profile: SafetyInspectionProfileKey; titleTh: string; items: TemplateItemInput[] },
  actor: Actor,
) {
  if (SPILL_PROFILES.has(input.profile) && !input.items.length) throw new Error('แม่แบบ Spill Kit ต้องมีรายการอย่างน้อยหนึ่งข้อ')
  const { data: latest, error: latestError } = await supabaseAdmin.from('lab_map_safety_form_templates').select('version').eq('profile', input.profile).order('version', { ascending: false }).limit(1).maybeSingle()
  fail(latestError)
  const version = Number(latest?.version ?? 0) + 1
  const { data: template, error } = await supabaseAdmin.from('lab_map_safety_form_templates').insert({
    profile: input.profile, version, title_th: input.titleTh.trim(), active: false, photo_required: false, created_by: actor.id,
  }).select('id').single()
  fail(error)
  try {
    if (input.items.length) fail((await supabaseAdmin.from('lab_map_safety_form_template_items').insert(input.items.map((item, index) => ({
      template_id: template!.id, item_key: item.itemKey.trim(), label_th: item.labelTh.trim(), sort_order: index + 1,
      expiry_required: item.expiryRequired, date_mode: item.dateMode,
    })))).error)
    await audit(actor.id, 'safety_task.monthly_template.create', String(template!.id), { profile: input.profile, version, itemCount: input.items.length })
  } catch (cause) {
    await supabaseAdmin.from('lab_map_safety_form_templates').delete().eq('id', template!.id)
    throw cause
  }
  return { id: String(template!.id), version }
}

export async function activateMonthlySafetyFormTemplate(templateId: string, actor: Actor) {
  const { data: target, error } = await supabaseAdmin.from('lab_map_safety_form_templates').select('*').eq('id', templateId).maybeSingle()
  fail(error)
  if (!target) throw new Error('ไม่พบแม่แบบ')
  if (SPILL_PROFILES.has(target.profile as SafetyInspectionProfileKey)) {
    const { count, error: countError } = await supabaseAdmin.from('lab_map_safety_form_template_items').select('*', { count: 'exact', head: true }).eq('template_id', templateId)
    fail(countError)
    if (!count) throw new Error('แม่แบบ Spill Kit ที่ไม่มีรายการไม่สามารถเปิดใช้งานได้')
  }
  const now = new Date().toISOString()
  const { data: previous, error: previousError } = await supabaseAdmin.from('lab_map_safety_form_templates').select('id').eq('profile', target.profile).eq('active', true).neq('id', templateId)
  fail(previousError)
  const previousIds = rows(previous).map(row => String(row.id))
  if (previousIds.length) fail((await supabaseAdmin.from('lab_map_safety_form_templates').update({ active: false, retired_at: now }).in('id', previousIds)).error)
  const activation = await supabaseAdmin.from('lab_map_safety_form_templates').update({ active: true, retired_at: null }).eq('id', templateId)
  if (activation.error) {
    if (previousIds.length) await supabaseAdmin.from('lab_map_safety_form_templates').update({ active: true, retired_at: null }).in('id', previousIds)
    fail(activation.error)
  }
  await audit(actor.id, 'safety_task.monthly_template.activate', templateId, { profile: target.profile, version: target.version, retiredTemplateIds: previousIds })
  return { id: templateId, profile: target.profile, version: Number(target.version) }
}
