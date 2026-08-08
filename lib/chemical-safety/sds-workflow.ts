import 'server-only'

import { NextResponse } from 'next/server'
import { requireChemicalCustodian, requireChemicalReviewer } from './access'
import { supabaseAdmin } from './../supabase/admin'
import type { Actor } from '@/lib/auth/guards'
import type { chemicalSdsDraftPatchSchema } from './schemas'
import type { z } from 'zod'

type SdsMetadata = z.infer<typeof chemicalSdsDraftPatchSchema>

export interface SdsVersionContext {
  id: string
  productId: string
  unitId: string
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
 * หา unit ของ SDS ฉบับหนึ่ง
 *
 * ตาราง chemical_sds_versions ผูกกับ product ไม่ได้ผูกกับ unit โดยตรง สิทธิ์ของ SDS
 * ห้องสารเคมีจึงต้องย้อนผ่าน holding ที่มี storage_scope = room ไม่ใช่แค่ unit_products
 * เพราะ product ที่มาจาก SDS แยกตามงานก็มี unit_products เช่นกัน
 */
async function unitIdsForProduct(productId: string): Promise<string[]> {
  const { data, error } = await supabaseAdmin
    .from('chemical_inventory_holdings')
    .select('unit_id')
    .eq('product_id', productId)
    .eq('storage_scope', 'room')
  if (error) throw error
  return [...new Set((data ?? []).map(row => String(row.unit_id)))]
}

async function loadVersion(id: string) {
  const { data, error } = await supabaseAdmin
    .from('chemical_sds_versions')
    .select('id, product_id, status, submitted_by, created_by, updated_at')
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

  const unitIds = await unitIdsForProduct(String(version.product_id))
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

export function resolveSdsForReviewer(id: string) {
  return resolve(id, requireChemicalReviewer)
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
