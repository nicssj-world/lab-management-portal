import 'server-only'

import { NextResponse } from 'next/server'
import { requireChemicalCustodian } from './access'
import { supabaseAdmin } from './../supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { chemicalSdsDraftPatchSchema } from './schemas'
import type { z } from 'zod'

type SdsMetadata = z.infer<typeof chemicalSdsDraftPatchSchema>

export interface SdsVersionContext {
  id: string
  productId: string
  unitId: string
  sourceHoldingId: string | null
  status: string
  submittedBy: string | null
  createdBy: string | null
  updatedAt: string
}

type Resolved =
  | { context: SdsVersionContext; actor: Actor; response?: undefined }
  | { context?: undefined; actor?: undefined; response: NextResponse }

function notFound() {
  return NextResponse.json({ error: 'ไม่พบรายการ' }, { status: 404 })
}

/**
 * หา unit ของ SDS ฉบับหนึ่งที่ยังไม่มี source_holding_id
 *
 * ข้อมูลเดิมบางฉบับผูกผ่าน department link/publication หรือมีเพียง product-level
 * association อยู่แล้ว จึงต้อง resolve association เดิมโดยไม่ขยายสิทธิ์ข้ามหน่วยงาน
 */
async function unitIdsForUnscopedVersion(versionId: string, productId: string): Promise<string[]> {
  const [linked, publications] = await Promise.all([
    supabaseAdmin
      .from('chemical_department_chemical_links')
      .select('holding_id')
      .eq('sds_version_id', versionId),
    supabaseAdmin
      .from('chemical_sds_publications')
      .select('source_holding_id')
      .eq('sds_version_id', versionId),
  ])
  if (linked.error) throw linked.error
  if (publications.error) throw publications.error

  const holdingIds = [
    ...(linked.data ?? []).map(row => String(row.holding_id)),
    ...(publications.data ?? []).map(row => String(row.source_holding_id)),
  ]

  if (holdingIds.length > 0) {
    const holdings = await supabaseAdmin
      .from('chemical_inventory_holdings')
      .select('unit_id')
      .in('id', holdingIds)
    if (holdings.error) throw holdings.error
    return [...new Set((holdings.data ?? []).map(row => String(row.unit_id)))]
  }

  const holdings = await supabaseAdmin
    .from('chemical_inventory_holdings')
    .select('unit_id')
    .eq('product_id', productId)
    .eq('storage_scope', 'room')
  if (holdings.error) throw holdings.error
  return [...new Set((holdings.data ?? []).map(row => String(row.unit_id)))]
}

async function loadVersion(id: string) {
  const { data, error } = await supabaseAdmin
    .from('chemical_sds_versions')
    .select('id, product_id, source_holding_id, workflow_origin, status, submitted_by, created_by, updated_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

async function resolve(
  id: string,
  guard: (unitId: string) => ReturnType<typeof requireChemicalCustodian>,
): Promise<Resolved> {
  const version = await loadVersion(id)
  if (!version) return { response: notFound() }

  let sourceHoldingId = version.source_holding_id ? String(version.source_holding_id) : null
  let unitIds: string[]
  if (sourceHoldingId) {
    const holding = await supabaseAdmin
      .from('chemical_inventory_holdings')
      .select('unit_id, product_id')
      .eq('id', sourceHoldingId)
      .maybeSingle()
    if (holding.error) throw holding.error
    if (!holding.data || String(holding.data.product_id) !== String(version.product_id)) {
      return { response: notFound() }
    }
    unitIds = [String(holding.data.unit_id)]
  } else {
    unitIds = await unitIdsForUnscopedVersion(String(version.id), String(version.product_id))
  }
  if (unitIds.length === 0) return { response: notFound() }

  let lastResponse: NextResponse | null = null
  for (const unitId of unitIds) {
    const result = await guard(unitId)
    if (!result.response) {
      return {
        actor: result.actor,
        context: {
          id: String(version.id),
          productId: String(version.product_id),
          unitId,
          sourceHoldingId,
          status: String(version.status),
          submittedBy: version.submitted_by ? String(version.submitted_by) : null,
          createdBy: version.created_by ? String(version.created_by) : null,
          updatedAt: String(version.updated_at),
        },
      }
    }
    lastResponse = result.response
  }
  return { response: lastResponse ?? notFound() }
}

export function resolveSdsForCustodian(id: string) {
  return resolve(id, requireChemicalCustodian)
}

/**
 * ทำให้ SDS ฉบับนี้ใช้งานได้และเผยแพร่ทันทีหลังบันทึกหรือแนบไฟล์
 *
 * ไม่มีขั้นตอนส่งทบทวน/อนุมัติแล้ว การบันทึกจึงต้องมีผลทันที ไม่งั้นเอกสารจะค้าง
 * อยู่ในสถานะที่ไม่มีใครปลดให้ได้อีก
 *
 * publish_chemical_sds ดึง publication ที่ยัง active ของสารตัวนี้มาชี้ฉบับปัจจุบันให้แล้ว
 * จึงเหลือแค่กรณีที่รายการทะเบียนนี้ยังไม่เคยเชื่อมเลยที่ต้องสร้าง publication ใหม่ —
 * ถ้าเรียก link ทุกครั้งที่บันทึก จะได้แถว stale เพิ่มขึ้นเรื่อย ๆ โดยไม่มีประโยชน์
 */
export async function publishSdsForHolding(
  context: SdsVersionContext,
  actorId: string,
): Promise<void> {
  const published = await supabaseAdmin.rpc('publish_chemical_sds', {
    p_version_id: context.id,
    p_actor_id: actorId,
  })
  if (published.error) throw published.error

  // ฉบับที่ไม่มี source holding โดยตรงยังไม่มีปลายทาง publication ที่ระบุแน่ชัด
  if (!context.sourceHoldingId) return

  const holding = await supabaseAdmin
    .from('chemical_inventory_holdings')
    .select('storage_scope')
    .eq('id', context.sourceHoldingId)
    .maybeSingle()
  if (holding.error) throw holding.error
  if (!holding.data) throw new Error('chemical_holding_not_found')

  const active = await supabaseAdmin
    .from('chemical_sds_publications')
    .select('id')
    .eq('product_id', context.productId)
    .eq('unit_id', context.unitId)
    .eq('destination', holding.data.storage_scope)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle()
  if (active.error) throw active.error
  if (active.data) return

  const linked = await supabaseAdmin.rpc('link_chemical_sds_publication', {
    p_holding_id: context.sourceHoldingId,
    p_sds_version_id: context.id,
    p_actor_id: actorId,
  })
  if (linked.error) throw linked.error
}

/**
 * SDS ที่ materializer สร้างจากคลัง MSDS 2568 มี created_by เป็น null เพราะไม่มีคนสร้าง
 * แต่ update_chemical_sds_draft ยอมให้เฉพาะผู้สร้างหรือผู้ส่งเท่านั้นที่แก้ได้
 * ถ้าไม่ทำอะไร ฉบับร่างที่นำเข้ามาจะแก้ไม่ได้เลยตลอดกาล
 *
 * จึงให้ custodian คนแรกที่เข้ามาแก้ "รับเป็นเจ้าของ" ฉบับร่างนั้น — บันทึกไว้ว่าใครรับไป
 * ไม่แตะ updated_at เพื่อไม่ให้ optimistic lock ของผู้เรียกเสียไป
 */
export async function claimOrphanDraft(context: SdsVersionContext, actorId: string): Promise<void> {
  if (context.createdBy !== null || context.submittedBy !== null) return
  const { error } = await supabaseAdmin
    .from('chemical_sds_versions')
    .update({ created_by: actorId })
    .eq('id', context.id)
    .is('created_by', null)
    .is('submitted_by', null)
  if (error) throw error
}

/** แปลงชื่อฟิลด์จากรูปแบบของ zod เป็นรูปแบบที่ RPC ต้องการ */
export function toSdsRpcMetadata(metadata: Partial<SdsMetadata>, fileId: string | null) {
  const payload: Record<string, unknown> = {
    source_url: null,
    manufacturer: metadata.manufacturer ?? null,
    supplier: metadata.supplier ?? null,
    product_code: metadata.productCode ?? null,
    concentration: metadata.concentration ?? null,
    language: metadata.language ?? 'th',
    revision_label: metadata.revisionLabel ?? null,
    effective_on: metadata.effectiveOn ?? null,
    review_due_on: metadata.reviewDueOn ?? null,
    signal_word: metadata.signalWord ?? null,
    pictogram_codes: metadata.pictogramCodes ?? [],
    h_statements: metadata.hStatements ?? [],
    p_statements: metadata.pStatements ?? [],
    storage_instructions: metadata.storageInstructions ?? null,
    incompatibilities: metadata.incompatibilities ?? null,
    emergency_summary: metadata.emergencySummary ?? null,
  }
  // ส่ง file_id เฉพาะเมื่อมีการเปลี่ยนไฟล์ ไม่งั้น RPC จะเขียนทับไฟล์เดิมเป็น null
  if (fileId !== null) payload.file_id = fileId
  return payload
}

export function toSdsRpcHazards(metadata: Partial<SdsMetadata>) {
  return (metadata.hazards ?? []).map(hazard => ({
    hazard_class: hazard.className,
    hazard_category: hazard.category,
  }))
}
