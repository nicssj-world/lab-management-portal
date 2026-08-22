import { NextResponse, type NextRequest } from 'next/server'
import { requireChemicalCustodian } from '@/lib/chemical-safety/access'
import {
  buildChemicalHoldingDeleteImpact,
  type ChemicalHoldingDeletePlannerInput,
} from '@/lib/chemical-safety/holding-delete'
import { unexpectedError } from '@/lib/chemical-safety/api'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { deleteChemicalSdsR2Objects } from '@/lib/chemical-safety/holding-delete-storage'

type HoldingDeleteRouteContext = { params: Promise<{ holdingId: string }> }

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`chemical holding delete: missing ${field}`)
  return value
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

function isNotFoundError(error: unknown): boolean {
  return /chemical_holding_not_found|holding_not_found|not_found/i.test(errorMessage(error))
}

async function loadHoldingDeleteInput(holdingId: string): Promise<ChemicalHoldingDeletePlannerInput | null> {
  const holdingResult = await supabaseAdmin
    .from('chemical_inventory_holdings')
    .select('id, product_id, unit_id')
    .eq('id', holdingId)
    .maybeSingle()
  if (holdingResult.error) throw holdingResult.error
  if (!holdingResult.data) return null

  const [productsResult, unitsResult, holdingsResult, versionsResult, publicationsResult, linksResult, departmentSdsResult, filesResult] = await Promise.all([
    supabaseAdmin.from('chemical_products').select('id, canonical_name'),
    supabaseAdmin.from('chemical_units').select('id, name_th'),
    supabaseAdmin.from('chemical_inventory_holdings').select('id, product_id, unit_id'),
    supabaseAdmin.from('chemical_sds_versions').select('id, product_id, source_holding_id, status, revision_label, file_id'),
    supabaseAdmin.from('chemical_sds_publications').select('id, product_id, source_holding_id, sds_version_id, destination, department_code, display_name, status'),
    supabaseAdmin.from('chemical_department_chemical_links').select('id, department_sds_id, product_id, holding_id, sds_version_id'),
    supabaseAdmin.from('chemical_department_sds').select('id, department_code, display_name, file_id'),
    supabaseAdmin.from('chemical_sds_files').select('id, file_name, r2_key'),
  ])
  for (const result of [productsResult, unitsResult, holdingsResult, versionsResult, publicationsResult, linksResult, departmentSdsResult, filesResult]) {
    if (result.error) throw result.error
  }

  const products = productsResult.data ?? []
  const units = unitsResult.data ?? []
  const targetProductId = requiredString(holdingResult.data.product_id, 'product_id')
  const targetUnitId = requiredString(holdingResult.data.unit_id, 'unit_id')
  const targetProduct = products.find(row => String(row.id) === targetProductId)
  const targetUnit = units.find(row => String(row.id) === targetUnitId)
  const productNames = new Map(products.map(row => [String(row.id), String(row.canonical_name)]))
  const unitNames = new Map(units.map(row => [String(row.id), String(row.name_th)]))
  const holdingLabels: Record<string, string> = {}
  for (const row of holdingsResult.data ?? []) {
    const id = requiredString(row.id, 'holding.id')
    const productName = productNames.get(String(row.product_id)) ?? String(row.product_id)
    const unitName = unitNames.get(String(row.unit_id)) ?? String(row.unit_id)
    holdingLabels[id] = `${productName} · ${unitName}`
  }

  return {
    holding: {
      id: requiredString(holdingResult.data.id, 'id'),
      productId: targetProductId,
      unitId: targetUnitId,
    },
    product: targetProduct ? {
      id: requiredString(targetProduct.id, 'product.id'),
      canonicalName: String(targetProduct.canonical_name),
    } : null,
    unit: targetUnit ? {
      id: requiredString(targetUnit.id, 'unit.id'),
      nameTh: String(targetUnit.name_th),
    } : null,
    versions: (versionsResult.data ?? []).map(row => ({
      id: requiredString(row.id, 'version.id'),
      productId: requiredString(row.product_id, 'version.product_id'),
      sourceHoldingId: nullableString(row.source_holding_id),
      status: String(row.status),
      revisionLabel: nullableString(row.revision_label),
      fileId: nullableString(row.file_id),
    })),
    publications: (publicationsResult.data ?? []).map(row => ({
      id: requiredString(row.id, 'publication.id'),
      productId: nullableString(row.product_id) ?? undefined,
      sourceHoldingId: requiredString(row.source_holding_id, 'publication.source_holding_id'),
      sdsVersionId: requiredString(row.sds_version_id, 'publication.sds_version_id'),
      destination: row.destination === 'department' ? 'department' as const : 'room' as const,
      departmentCode: nullableString(row.department_code),
      displayName: String(row.display_name),
      status: String(row.status),
    })),
    links: (linksResult.data ?? []).map(row => ({
      id: requiredString(row.id, 'link.id'),
      departmentSdsId: requiredString(row.department_sds_id, 'link.department_sds_id'),
      productId: requiredString(row.product_id, 'link.product_id'),
      holdingId: requiredString(row.holding_id, 'link.holding_id'),
      sdsVersionId: nullableString(row.sds_version_id),
    })),
    departmentSds: (departmentSdsResult.data ?? []).map(row => ({
      id: requiredString(row.id, 'department_sds.id'),
      departmentCode: requiredString(row.department_code, 'department_sds.department_code'),
      displayName: String(row.display_name),
      fileId: requiredString(row.file_id, 'department_sds.file_id'),
    })),
    files: (filesResult.data ?? []).map(row => ({
      id: requiredString(row.id, 'file.id'),
      fileName: String(row.file_name),
      r2Key: requiredString(row.r2_key, 'file.r2_key'),
    })),
    holdingLabels,
  }
}

async function loadSnapshot(holdingId: string) {
  const input = await loadHoldingDeleteInput(holdingId)
  return input ? { input, impact: buildChemicalHoldingDeleteImpact(input) } : null
}

async function guardForSnapshot(snapshot: Awaited<ReturnType<typeof loadSnapshot>>) {
  if (!snapshot) return null
  return requireChemicalCustodian(snapshot.input.holding.unitId)
}

async function recordCleanupFailure(actorId: string, holdingId: string, failedKeys: readonly string[]) {
  if (failedKeys.length === 0) return true
  try {
    const result = await supabaseAdmin.from('audit_log').insert({
      action: 'chemical_safety.sds.cleanup_failure',
      user_id: actorId,
      target: holdingId,
      detail: JSON.stringify({
        failedKeys,
        cleanupCommand: 'chemical-safety:cleanup-sds',
      }),
    })
    return !result.error
  } catch {
    return false
  }
}

export async function GET(
  _request: NextRequest,
  ctx: HoldingDeleteRouteContext,
) {
  const { holdingId } = await ctx.params
  try {
    const snapshot = await loadSnapshot(holdingId)
    if (!snapshot) return NextResponse.json({ error: 'ไม่พบรายการทะเบียนสารเคมี' }, { status: 404 })
    const guard = await guardForSnapshot(snapshot)
    if (guard?.response) return guard.response
    return NextResponse.json({ impact: snapshot.impact })
  } catch (error) {
    return unexpectedError(error)
  }
}

export async function DELETE(
  _request: NextRequest,
  ctx: HoldingDeleteRouteContext,
) {
  const { holdingId } = await ctx.params
  try {
    const snapshot = await loadSnapshot(holdingId)
    if (!snapshot) return NextResponse.json({ error: 'ไม่พบรายการทะเบียนสารเคมี' }, { status: 404 })
    const guard = await guardForSnapshot(snapshot)
    if (guard?.response) return guard.response

    const deletion = await supabaseAdmin.rpc('delete_chemical_holding_cascade', {
      p_holding_id: holdingId,
      p_actor_id: guard!.actor.id,
    })
    if (deletion.error) {
      if (isNotFoundError(deletion.error)) {
        return NextResponse.json({ error: 'ไม่พบรายการทะเบียนสารเคมี' }, { status: 404 })
      }
      throw deletion.error
    }

    const payload = (deletion.data ?? {}) as { fileKeys?: unknown }
    const fileKeys = Array.isArray(payload.fileKeys)
      ? payload.fileKeys.filter((key): key is string => typeof key === 'string' && key.length > 0)
      : []
    const cleanup = await deleteChemicalSdsR2Objects(fileKeys)
    const cleanupFailureRecorded = await recordCleanupFailure(guard!.actor.id, holdingId, cleanup.failedKeys)
    return NextResponse.json({
      ok: true,
      deleted: deletion.data,
      cleanup: {
        ok: cleanup.failedKeys.length === 0,
        failedKeys: cleanup.failedKeys,
        failureRecorded: cleanupFailureRecorded,
      },
    })
  } catch (error) {
    return unexpectedError(error)
  }
}
