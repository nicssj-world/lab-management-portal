import 'server-only'

import type { Actor } from '@/lib/auth/guards'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { z } from 'zod'
import type { monthlySafetyAssetConfigSchema } from '@/lib/validations/lab-map-safety'
import { bangkokToday } from './logic'

type Row = Record<string, any>
type ConfigInput = z.infer<typeof monthlySafetyAssetConfigSchema>

function rows(value: unknown): Row[] { return Array.isArray(value) ? value : [] }
function fail(error: { message?: string } | null | undefined) { if (error) throw new Error(error.message || 'Monthly Safety Asset operation failed') }
function value(value: unknown) { return typeof value === 'string' ? value : null }
function previousDate(date: string) {
  const result = new Date(`${date}T00:00:00Z`); result.setUTCDate(result.getUTCDate() - 1)
  return result.toISOString().slice(0, 10)
}
function nullableEqual(left: unknown, right: unknown) { return (left ?? null) === (right ?? null) }
function nextMonthStart() {
  const [year, month] = bangkokToday().split('-').map(Number)
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10)
}

async function audit(actorId: string, action: string, target: string, detail: unknown) {
  fail((await supabaseAdmin.from('audit_log').insert({ action, user_id: actorId, target, detail: JSON.stringify(detail) })).error)
}

export async function getMonthlySafetyAssetConfig(assetId: string, profileOverride?: string | null) {
  const { data: asset, error: assetError } = await supabaseAdmin.from('lab_map_safety_assets').select('id,code,name_th,kind,inspection_profile,activated_on').eq('id', assetId).maybeSingle()
  fail(assetError)
  if (!asset) throw new Error('ไม่พบอุปกรณ์')
  const [{ data: assignments, error: assignmentError }, { data: supplies, error: supplyError }, { data: people, error: peopleError }] = await Promise.all([
    supabaseAdmin.from('lab_map_safety_asset_assignments').select('*').eq('asset_id', assetId).is('active_to', null).order('assignment_role'),
    supabaseAdmin.from('lab_map_safety_asset_supplies').select('*').eq('asset_id', assetId).is('retired_on', null).order('label_th'),
    supabaseAdmin.from('profiles').select('id,name,dept,role').eq('status', 'active').is('deleted_at', null).order('name'),
  ])
  fail(assignmentError); fail(supplyError); fail(peopleError)
  const profile = profileOverride ?? value(asset.inspection_profile)
  let template: Row | null = null
  let templateItems: Row[] = []
  if (profile) {
    const templateResult = await supabaseAdmin.from('lab_map_safety_form_templates').select('*').eq('profile', profile).eq('active', true).maybeSingle()
    fail(templateResult.error); template = templateResult.data as Row | null
    if (template) {
      const itemResult = await supabaseAdmin.from('lab_map_safety_form_template_items').select('*').eq('template_id', template.id).order('sort_order')
      fail(itemResult.error); templateItems = rows(itemResult.data)
    }
  }
  return { asset, assignments: rows(assignments), supplies: rows(supplies), people: rows(people), template, templateItems }
}

function supplyUnchanged(current: Row, input: ConfigInput['supplies'][number]) {
  return current.template_item_id === input.templateItemId && current.supply_type === input.supplyType
    && current.internal_code === input.internalCode && current.label_th === input.labelTh
    && nullableEqual(current.manufactured_or_packed_on, input.manufacturedOrPackedOn)
    && nullableEqual(current.purchased_on, input.purchasedOn) && nullableEqual(current.expires_on, input.expiresOn)
    && nullableEqual(current.supplier, input.supplier)
}

export async function saveMonthlySafetyAssetConfig(assetId: string, input: ConfigInput, actor: Actor) {
  const { data: asset, error: assetError } = await supabaseAdmin.from('lab_map_safety_assets').select('*').eq('id', assetId).maybeSingle()
  fail(assetError)
  if (!asset) throw new Error('ไม่พบอุปกรณ์')
  if (input.activatedOn !== nextMonthStart()) throw new Error('การแก้ทะเบียนรายเดือนต้องเริ่มวันที่ 1 ของเดือนถัดไป')
  if (input.profile === 'nss_eyewash' && asset.kind !== 'nss-eyewash') throw new Error('Profile NSS ใช้กับประเภทน้ำยาล้างตา NSS เท่านั้น')
  if (input.profile?.endsWith('spill_kit') && asset.kind !== 'spill-kit') throw new Error('Profile Spill Kit ใช้กับอุปกรณ์ประเภท Spill Kit เท่านั้น')
  if (input.profile) {
    const templateResult = await supabaseAdmin.from('lab_map_safety_form_templates').select('id').eq('profile', input.profile).eq('active', true).maybeSingle()
    fail(templateResult.error)
    if (!templateResult.data) throw new Error('แม่แบบของ profile นี้ยังไม่ active')
    if (input.profile.endsWith('spill_kit')) {
      const itemResult = await supabaseAdmin.from('lab_map_safety_form_template_items').select('id').eq('template_id', templateResult.data.id)
      fail(itemResult.error)
      const expected = new Set(rows(itemResult.data).map(row => String(row.id)))
      const submitted = new Set(input.supplies.map(item => item.templateItemId).filter(Boolean))
      if (expected.size !== submitted.size || [...expected].some(id => !submitted.has(id))) throw new Error('กรุณาลงทะเบียนรายการ Spill Kit ให้ครบตามแม่แบบ active')
    }
  }

  const [{ data: currentAssignments, error: assignmentError }, { data: currentProfiles, error: profileError }, { data: currentSupplies, error: supplyError }] = await Promise.all([
    supabaseAdmin.from('lab_map_safety_asset_assignments').select('*').eq('asset_id', assetId).is('active_to', null),
    supabaseAdmin.from('lab_map_safety_asset_profile_history').select('*').eq('asset_id', assetId).is('active_to', null).order('active_from', { ascending: false }),
    supabaseAdmin.from('lab_map_safety_asset_supplies').select('*').eq('asset_id', assetId).is('retired_on', null),
  ])
  fail(assignmentError); fail(profileError); fail(supplyError)
  const assignmentRows = rows(currentAssignments)
  const profileRows = rows(currentProfiles)
  const supplyRows = rows(currentSupplies)
  const endOn = previousDate(input.activatedOn)

  const currentProfile = profileRows[0]
  const profileChanged = (currentProfile?.profile ?? null) !== input.profile
  if (profileChanged && currentProfile) {
    const result = currentProfile.active_from >= input.activatedOn
      ? await supabaseAdmin.from('lab_map_safety_asset_profile_history').delete().eq('id', currentProfile.id)
      : await supabaseAdmin.from('lab_map_safety_asset_profile_history').update({ active_to: endOn }).eq('id', currentProfile.id)
    fail(result.error)
  }
  if (profileChanged && input.profile) fail((await supabaseAdmin.from('lab_map_safety_asset_profile_history').insert({
    asset_id: assetId, profile: input.profile, active_from: input.activatedOn, created_by: actor.id,
  })).error)

  for (const current of assignmentRows) {
    const keep = input.assignments.some(item => item.userId === current.user_id && item.assignmentRole === current.assignment_role)
    if (!keep) {
      const result = current.active_from >= input.activatedOn
        ? await supabaseAdmin.from('lab_map_safety_asset_assignments').delete().eq('id', current.id)
        : await supabaseAdmin.from('lab_map_safety_asset_assignments').update({ active_to: endOn }).eq('id', current.id)
      fail(result.error)
    }
  }
  const newAssignments = input.assignments.filter(item => !assignmentRows.some(current => current.user_id === item.userId && current.assignment_role === item.assignmentRole)).map(item => ({
    asset_id: assetId, user_id: item.userId, assignment_role: item.assignmentRole,
    active_from: input.activatedOn, created_by: actor.id,
  }))
  if (newAssignments.length) fail((await supabaseAdmin.from('lab_map_safety_asset_assignments').insert(newAssignments)).error)

  const desiredIds = new Set(input.supplies.map(item => item.id).filter(Boolean))
  const deletedSupplyIds = new Set<string>()
  for (const current of supplyRows) {
    const desired = input.supplies.find(item => item.id === current.id)
    if (!desiredIds.has(current.id) || (desired && !supplyUnchanged(current, desired))) {
      if (current.activated_on >= input.activatedOn) {
        fail((await supabaseAdmin.from('lab_map_safety_asset_supplies').delete().eq('id', current.id)).error)
        deletedSupplyIds.add(String(current.id))
      } else {
        fail((await supabaseAdmin.from('lab_map_safety_asset_supplies').update({ retired_on: endOn }).eq('id', current.id)).error)
      }
    }
  }
  const newSupplies = input.supplies.filter(item => {
    const current = item.id ? supplyRows.find(row => row.id === item.id) : null
    return !current || !supplyUnchanged(current, item)
  }).map(item => ({
    asset_id: assetId, template_item_id: item.templateItemId, supply_type: item.supplyType,
    internal_code: item.internalCode, label_th: item.labelTh,
    manufactured_or_packed_on: item.manufacturedOrPackedOn, purchased_on: item.purchasedOn,
    expires_on: item.expiresOn, supplier: item.supplier, activated_on: input.activatedOn,
    replacement_for_id: item.id && !deletedSupplyIds.has(item.id) ? item.id : null, created_by: actor.id,
  }))
  if (newSupplies.length) fail((await supabaseAdmin.from('lab_map_safety_asset_supplies').insert(newSupplies)).error)

  fail((await supabaseAdmin.from('lab_map_safety_assets').update({
    inspection_profile: input.profile,
    activated_on: profileChanged ? input.activatedOn : asset.activated_on,
    updated_at: new Date().toISOString(),
  }).eq('id', assetId)).error)
  await audit(actor.id, 'lab_map.safety_asset.monthly_config', assetId, {
    profile: input.profile, activatedOn: input.activatedOn, assignments: input.assignments,
    supplies: input.supplies.map(item => ({ id: item.id ?? null, internalCode: item.internalCode })),
  })
  return getMonthlySafetyAssetConfig(assetId)
}
