import { config } from 'dotenv'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import {
  JUNE_2026_MASTERLIST_ROWS,
  JUNE_2026_MASTERLIST_SHA256,
  buildJune2026NormalizedProposals,
} from '../lib/chemical-safety/import/masterlist-june-2026'
import {
  buildChemicalMasterlistMaterializationPlan,
  materializeChemicalMasterlist,
  type ChemicalMaterializationDatabase,
  type ChemicalMaterializationProduct,
} from '../lib/chemical-safety/materialize'
import { normalizeChemicalName } from '../lib/chemical-safety/domain'

config({ path: '.env.local', override: false })
config({ path: '.env', override: false })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })

function assertResult(result: { error: unknown }, operation: string): void {
  if (!result.error) return
  const message = typeof result.error === 'object' && result.error && 'message' in result.error
    ? String(result.error.message)
    : String(result.error)
  throw new Error(`${operation} failed: ${message}`)
}

function createDatabase(client: SupabaseClient): ChemicalMaterializationDatabase {
  return {
    async ensureUnit(input) {
      const result = await client.from('chemical_units').upsert({ code: input.code, name_th: input.nameTh, active: true }, { onConflict: 'code' }).select('id').single()
      assertResult(result, `ensure unit ${input.code}`)
      return result.data!.id
    },
    async ensureRoom(input) {
      const result = await client.from('chemical_rooms').upsert({ code: input.code, name_th: input.nameTh, active: true }, { onConflict: 'code' }).select('id').single()
      assertResult(result, `ensure room ${input.code}`)
      return result.data!.id
    },
    async ensureLocation(roomId, input) {
      const result = await client.from('chemical_storage_locations').upsert({
        room_id: roomId,
        code: input.code,
        zone_code: input.zoneCode,
        location_kind: input.locationKind,
        display_order: input.displayOrder,
        active: true,
      }, { onConflict: 'room_id,code' }).select('id').single()
      assertResult(result, `ensure location ${input.code}`)
      return result.data!.id
    },
    async ensureProduct(input) {
      // GHS มาจาก master list จึงเขียนทับได้ทุกรอบ — master list คือแหล่งอ้างอิงของค่านี้
      // (ค่าที่ผู้ทบทวนกรอกเองอยู่บน chemical_sds_versions คนละที่กัน จึงไม่ถูกแตะ)
      const ghs = {
        ghs_source_text: input.ghsSourceText,
        ghs_pictogram_codes: input.ghsPictogramCodes,
        ghs_hazard_classes: input.ghsHazardClasses.map(hazard => ({
          class_th: hazard.classTh,
          class_en: hazard.classEn,
        })),
      }
      const existing = await client.from('chemical_products').select('id').eq('canonical_name', input.canonicalName).eq('lifecycle_status', 'active').limit(1).maybeSingle()
      assertResult(existing, `find product ${input.canonicalName}`)
      if (existing.data) {
        const updated = await client.from('chemical_products').update({ ...ghs, updated_at: new Date().toISOString() }).eq('id', existing.data.id)
        assertResult(updated, `update product ghs ${input.canonicalName}`)
        return existing.data.id
      }
      const inserted = await client.from('chemical_products').insert({ canonical_name: input.canonicalName, lifecycle_status: 'active', ...ghs }).select('id').single()
      assertResult(inserted, `create product ${input.canonicalName}`)
      return inserted.data!.id
    },
    async ensureAlias(productId, alias) {
      const result = await client.from('chemical_product_aliases').upsert({
        product_id: productId,
        alias,
        normalized_alias: normalizeChemicalName(alias),
      }, { onConflict: 'product_id,normalized_alias' })
      assertResult(result, `ensure alias ${alias}`)
    },
    async ensureUnitProduct(productId, unitId, preferredName, publicEligible) {
      const result = await client.from('chemical_unit_products').upsert({
        product_id: productId,
        unit_id: unitId,
        preferred_name: preferredName,
        active: true,
        public_eligible: publicEligible,
      }, { onConflict: 'product_id,unit_id' })
      assertResult(result, `ensure unit product ${preferredName}`)
    },
    async ensureHolding(productId, unitId, locationId, input) {
      await ensureHolding(client, productId, unitId, locationId, input)
    },
    async linkImportRow(batchId, rowNo, productId) {
      const result = await client.from('chemical_import_rows').update({
        target_product_id: productId,
        decision_note: 'Materialized from the current June 2026 masterlist',
        decided_at: new Date().toISOString(),
      }).eq('batch_id', batchId).eq('row_key', String(rowNo)).select('id').single()
      assertResult(result, `link masterlist row ${rowNo}`)
    },
    async ensureDraftSds(productId, fileId) {
      const existing = await client.from('chemical_sds_versions').select('id').eq('product_id', productId).eq('file_id', fileId).limit(1).maybeSingle()
      assertResult(existing, 'find imported SDS draft')
      if (existing.data) return
      const inserted = await client.from('chemical_sds_versions').insert({
        product_id: productId,
        file_id: fileId,
        revision_label: 'Imported from MSDS 2568 archive',
        status: 'draft',
      })
      assertResult(inserted, 'create imported SDS draft')
    },
  }
}

async function ensureHolding(
  client: SupabaseClient,
  productId: string,
  unitId: string,
  locationId: string,
  input: ChemicalMaterializationProduct,
): Promise<void> {
  const lotNumber = `MASTERLIST-JUNE-2026-${input.rowNo}`
  const payload = {
    product_id: productId,
    unit_id: unitId,
    location_id: locationId,
    lot_number: lotNumber,
    package_value: input.packageValue,
    package_unit: input.packageUnit,
    current_container_count: input.currentContainerCount,
    minimum_stock: input.minimumStock,
    // The inventory total is calculated from package parts; the old free-text
    // reported total is intentionally no longer materialized.
    reported_total_raw: null,
    calculated_total_value: input.calculatedTotalValue,
    calculated_total_unit: input.calculatedTotalUnit,
    effective_on: '2026-06-01',
    updated_at: new Date().toISOString(),
  }
  const existing = await client.from('chemical_inventory_holdings').select('id').eq('lot_number', lotNumber).limit(1).maybeSingle()
  assertResult(existing, `find holding row ${input.rowNo}`)
  const result = existing.data
    ? await client.from('chemical_inventory_holdings').update(payload).eq('id', existing.data.id)
    : await client.from('chemical_inventory_holdings').insert(payload)
  assertResult(result, `ensure holding row ${input.rowNo}`)
}

async function main() {
  const batch = await supabase.from('chemical_import_batches').select('id').eq('source_kind', 'chemical-masterlist-june-2026').eq('source_sha256', JUNE_2026_MASTERLIST_SHA256).eq('status', 'completed').single()
  assertResult(batch, 'load completed masterlist batch')
  const importRows = await supabase.from('chemical_import_rows').select('row_key,match_status,normalized_data').eq('batch_id', batch.data!.id).order('row_key')
  assertResult(importRows, 'load masterlist import rows')
  if (importRows.data!.length !== 25) throw new Error(`Expected 25 masterlist rows, received ${importRows.data!.length}`)

  const evidenceHashes = importRows.data!.flatMap(row => {
    const normalized = row.normalized_data as { sdsEvidence?: { sha256?: string | null } } | null
    return normalized?.sdsEvidence?.sha256 ? [normalized.sdsEvidence.sha256] : []
  })
  const files = evidenceHashes.length > 0
    ? await supabase.from('chemical_sds_files').select('id,sha256').in('sha256', evidenceHashes)
    : { data: [], error: null }
  assertResult(files, 'resolve SDS evidence files')
  const fileIdByHash = new Map((files.data ?? []).map(file => [file.sha256, file.id]))
  const evidence = importRows.data!.map(row => {
    const normalized = row.normalized_data as { sdsEvidence?: { sha256?: string | null } } | null
    const sha256 = normalized?.sdsEvidence?.sha256 ?? null
    return {
      rowNo: Number(row.row_key),
      matchStatus: row.match_status,
      fileId: sha256 ? fileIdByHash.get(sha256) ?? null : null,
    }
  })

  const plan = buildChemicalMasterlistMaterializationPlan(
    JUNE_2026_MASTERLIST_ROWS,
    buildJune2026NormalizedProposals(JUNE_2026_MASTERLIST_ROWS),
  )
  await materializeChemicalMasterlist(batch.data!.id, plan, evidence, createDatabase(supabase))
  console.log(JSON.stringify({ products: plan.products.length, units: plan.units.length, locations: plan.locations.length, draftSds: evidence.filter(item => item.matchStatus === 'candidate' && item.fileId).length }))
}

void main()
