import 'server-only'

import { calculateHoldingTotal, calculateHoldingTotalFromFields, currentSdsState, isQuantityUnit } from './domain'
import type { QuantityPart, QuantityTotal } from './domain'
import type {
  ChemicalChangeRequestListItemDTO,
  ChemicalImportRowDTO,
  ChemicalPhysicalState,
  ChemicalProductDTO,
  ChemicalRoomDTO,
  ChemicalRegistryFilters,
  ChemicalRegistryRow,
  ChemicalSdsDTO,
  ChemicalSdsHazardDTO,
  ChemicalStorageLocationDTO,
  GhsPictogramCode,
  JsonValue,
} from './types'
import type { ImportReviewFilters, InternalSdsFilters } from './schemas'
import { mapChemicalPlacement } from './registry-row'
import { camelProposal } from './proposal-keys'
import {
  roomChemicalSdsVersionIds,
  sdsVersionIdsForHolding,
  sharedDepartmentHoldingIdsForVersion,
} from './sds-visibility'
import { supabaseAdmin } from '@/lib/supabase/admin'

type Row = Record<string, any>

export interface ChemicalRepositorySnapshot {
  products: Row[]
  aliases: Row[]
  units: Row[]
  unitProducts: Row[]
  holdings: Row[]
  rooms: Row[]
  locations: Row[]
  sdsVersions: Row[]
  sdsPublications: Row[]
  sdsDepartmentLinks: Row[]
  sdsHazards: Row[]
  importRows: Row[]
  importBatches: Row[]
  pendingChanges: Row[]
}

export interface ChemicalRepositorySource {
  loadSnapshot(): Promise<ChemicalRepositorySnapshot>
}

async function selectAll(table: string): Promise<Row[]> {
  const { data, error } = await (supabaseAdmin.from(table) as any).select('*')
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

const databaseSource: ChemicalRepositorySource = {
  async loadSnapshot() {
    const [products, aliases, units, unitProducts, holdings, rooms, locations, sdsVersions, sdsPublications, sdsDepartmentLinks, sdsHazards, importRows, importBatches, pendingChanges] = await Promise.all([
      selectAll('chemical_products'),
      selectAll('chemical_product_aliases'),
      selectAll('chemical_units'),
      selectAll('chemical_unit_products'),
      selectAll('chemical_inventory_holdings'),
      selectAll('chemical_rooms'),
      selectAll('chemical_storage_locations'),
      selectAll('chemical_sds_versions'),
      selectAll('chemical_sds_publications'),
      selectAll('chemical_department_chemical_links'),
      selectAll('chemical_sds_hazards'),
      selectAll('chemical_import_rows'),
      selectAll('chemical_import_batches'),
      selectAll('chemical_change_requests'),
    ])
    return { products, aliases, units, unitProducts, holdings, rooms, locations, sdsVersions, sdsPublications, sdsDepartmentLinks, sdsHazards, importRows, importBatches, pendingChanges }
  },
}

function text(value: unknown): string | null {
  return value == null ? null : String(value)
}

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function jsonObject(value: unknown): Record<string, JsonValue> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, JsonValue> : {}
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
}

function importedQuantityParts(value: unknown): QuantityPart[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const parts: QuantityPart[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null
    const part = item as Record<string, unknown>
    if (
      typeof part.value !== 'number'
      || !Number.isFinite(part.value)
      || part.value < 0
      || !isQuantityUnit(part.unit)
      || typeof part.count !== 'number'
      || !Number.isInteger(part.count)
      || part.count < 0
    ) return null
    parts.push({ value: part.value, unit: part.unit, count: part.count })
  }
  return parts
}

function importedCalculatedTotal(importEvidence: Row | undefined): QuantityTotal | null {
  const normalizedData = importEvidence?.normalized_data
  if (!normalizedData || typeof normalizedData !== 'object' || Array.isArray(normalizedData)) return null
  const parts = importedQuantityParts((normalizedData as Record<string, unknown>).packageParts)
  if (!parts) return null
  try {
    return calculateHoldingTotal(parts)
  } catch {
    return null
  }
}

function sameQuantityTotal(left: QuantityTotal | null, right: QuantityTotal | null): boolean {
  return left?.unit === right?.unit && left?.value === right?.value
}

function importedPackageRaw(importEvidence: Row | undefined): string | null {
  const normalizedPackageRaw = text(jsonObject(importEvidence?.normalized_data).packageRaw)?.trim()
  if (normalizedPackageRaw) return normalizedPackageRaw

  const surveyPackageRaw = text(jsonObject(importEvidence?.raw_data).packageRaw)?.trim()
  if (surveyPackageRaw) return surveyPackageRaw

  const parts = importedQuantityParts(jsonObject(importEvidence?.normalized_data).packageParts)
  if (!parts) return null
  const sizes = [...new Set(parts.map(part => `${part.value} ${part.unit}`))]
  return sizes.length > 0 ? sizes.join(', ') : null
}

function calculateRegistryQuantity(input: {
  packageValue: number | null
  packageUnit: unknown
  currentContainerCount: number | null
  importEvidence?: Row
  stored: QuantityTotal | null
}): QuantityTotal | null {
  const imported = importedCalculatedTotal(input.importEvidence)
  const packageUnit = isQuantityUnit(input.packageUnit) ? input.packageUnit : null
  const matchesImportedShape = imported
    && input.packageValue != null
    && packageUnit != null
    && input.currentContainerCount != null
    && Array.isArray(input.importEvidence?.normalized_data?.packageParts)
    && (() => {
      const parts = importedQuantityParts(input.importEvidence?.normalized_data?.packageParts)
      const first = parts?.[0]
      return Boolean(
        first
        && first.value === input.packageValue
        && first.unit === packageUnit
        && parts.reduce((sum, part) => sum + part.count, 0) === input.currentContainerCount,
      )
    })()

  // Rebuild imported rows from their package parts so mixed sizes such as
  // 2.5 L + 1 L remain 3.5 L instead of using the first size × total count.
  if (matchesImportedShape && (!input.stored || sameQuantityTotal(input.stored, imported))) return imported

  return calculateHoldingTotalFromFields({
    packageValue: input.packageValue,
    packageUnit: input.packageUnit,
    currentContainerCount: input.currentContainerCount,
  }) ?? imported ?? input.stored
}

function mapSds(row: Row, hazards: Row[], linkedHoldingIds: string[] = []): ChemicalSdsDTO {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    sourceHoldingId: text(row.source_holding_id),
    linkedHoldingIds,
    workflowOrigin: row.workflow_origin === 'registry_v2' ? 'registry_v2' : 'current',
    fileId: text(row.file_id),
    sourceUrl: text(row.source_url),
    fileUrl: row.file_id ? `/api/admin/chemical-safety/sds/${row.id}/file` : null,
    manufacturer: text(row.manufacturer),
    supplier: text(row.supplier),
    productCode: text(row.product_code),
    concentration: text(row.concentration),
    language: text(row.language),
    revisionLabel: text(row.revision_label),
    effectiveOn: text(row.effective_on),
    reviewDueOn: text(row.review_due_on),
    signalWord: text(row.signal_word),
    pictogramCodes: stringArray(row.pictogram_codes) as GhsPictogramCode[],
    hStatements: Array.isArray(row.h_statements) ? row.h_statements : [],
    pStatements: Array.isArray(row.p_statements) ? row.p_statements : [],
    storageInstructions: text(row.storage_instructions),
    incompatibilities: text(row.incompatibilities),
    emergencySummary: text(row.emergency_summary),
    status: row.status,
    submittedBy: text(row.submitted_by),
    submittedAt: text(row.submitted_at),
    reviewedBy: text(row.reviewed_by),
    reviewedAt: text(row.reviewed_at),
    reviewReason: text(row.review_reason),
    createdBy: text(row.created_by),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    hazards: hazards.filter(item => item.sds_version_id === row.id).map(item => ({
      id: String(item.id),
      sdsVersionId: String(item.sds_version_id),
      hazardClass: String(item.hazard_class),
      hazardCategory: String(item.hazard_category),
    } satisfies ChemicalSdsHazardDTO)),
  }
}

export async function listChemicalRegistryWithSource(
  source: ChemicalRepositorySource,
  filters: ChemicalRegistryFilters = {},
): Promise<ChemicalRegistryRow[]> {
  const snapshot = await source.loadSnapshot()
  const unitById = new Map(snapshot.units.map(row => [row.id, row]))
  const locationById = new Map(snapshot.locations.map(row => [row.id, row]))
  const roomById = new Map(snapshot.rooms.map(row => [row.id, row]))
  const aliasesByProduct = new Map<string, string[]>()
  for (const alias of snapshot.aliases) {
    const values = aliasesByProduct.get(alias.product_id) ?? []
    values.push(String(alias.alias))
    aliasesByProduct.set(alias.product_id, values)
  }
  const sdsByProduct = new Map<string, Row[]>()
  for (const version of snapshot.sdsVersions) {
    const values = sdsByProduct.get(version.product_id) ?? []
    values.push(version)
    sdsByProduct.set(version.product_id, values)
  }
  const today = new Date().toISOString().slice(0, 10)
  const rows: ChemicalRegistryRow[] = []

  for (const holding of snapshot.holdings) {
    const product = snapshot.products.find(item => item.id === holding.product_id)
    const unitProduct = snapshot.unitProducts.find(item => item.product_id === holding.product_id && item.unit_id === holding.unit_id)
    const unit = unitById.get(holding.unit_id)
    const location = locationById.get(holding.location_id)
    const placement = mapChemicalPlacement(holding, location)
    const room = placement.storageScope === 'room' && location ? roomById.get(location.room_id) : null
    if (!product || !unit || !unitProduct) continue
    const versions = sdsByProduct.get(product.id) ?? []
    const holdingVersionIds = sdsVersionIdsForHolding(
      versions,
      snapshot.sdsDepartmentLinks,
      String(holding.id),
      snapshot.sdsPublications,
      snapshot.holdings,
    )
    const holdingVersions = versions.filter(item => holdingVersionIds.has(String(item.id)))
    const approved = holdingVersions
      .filter(item => item.status === 'approved')
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0] ?? null
    const selectedVersion = holdingVersions
      .filter(item => ['draft', 'in_review', 'rejected', 'approved'].includes(String(item.status)))
      .sort((a, b) => (
        Number(Boolean(b.file_id)) - Number(Boolean(a.file_id))
        || ({ approved: 4, in_review: 3, draft: 2, rejected: 1 }[String(b.status)] ?? 0)
          - ({ approved: 4, in_review: 3, draft: 2, rejected: 1 }[String(a.status)] ?? 0)
        || String(b.updated_at).localeCompare(String(a.updated_at))
      ))[0] ?? null
    const holdingPublications = snapshot.sdsPublications
      .filter(item => String(item.source_holding_id) === String(holding.id))
      .sort((a, b) => String(b.linked_at).localeCompare(String(a.linked_at)))
    const activePublication = holdingPublications.find(item => item.status === 'active')
    const stalePublication = holdingPublications.find(item => item.status === 'stale')
    const publicationStatus = activePublication
      ? 'active'
      : stalePublication
        ? 'stale'
        : approved
          ? 'ready'
          : 'unlinked'
    const holdingImportEvidence = snapshot.importRows.find(item => {
      const normalized = jsonObject(item.normalized_data)
      return typeof normalized.holdingId === 'string' && normalized.holdingId === String(holding.id)
    })
    const importEvidence = holdingImportEvidence ?? snapshot.importRows.find(item => item.target_product_id === product.id)
    const sdsStatus = currentSdsState({
      status: selectedVersion?.status === 'rejected' ? 'draft' : selectedVersion?.status ?? null,
      reviewDueOn: approved ? text(approved.review_due_on) : null,
      matchStatus: approved || selectedVersion ? null : importEvidence?.match_status ?? 'missing',
    }, today)
    // GHS จากเอกสาร SDS ที่ผ่านการทบทวนแล้วชนะเสมอ ถ้ายังไม่มีจึงใช้ค่าที่แปลงจาก master list
    // ก่อนหน้านี้อ่านจากฉบับที่อนุมัติอย่างเดียว คอลัมน์ GHS จึงว่างทุกแถวจนกว่าจะมีคนอนุมัติ
    const sdsPictograms = approved ? stringArray(approved.pictogram_codes) as GhsPictogramCode[] : []
    const masterlistPictograms = stringArray(product.ghs_pictogram_codes) as GhsPictogramCode[]
    const useSdsGhs = sdsPictograms.length > 0
    const pictograms = useSdsGhs ? sdsPictograms : masterlistPictograms
    const sdsHazards = approved ? snapshot.sdsHazards.filter(item => item.sds_version_id === approved.id).map(item => ({
      className: String(item.hazard_class), category: String(item.hazard_category),
    })) : []
    const masterlistHazards = Array.isArray(product.ghs_hazard_classes)
      ? (product.ghs_hazard_classes as Array<Record<string, unknown>>)
        .filter(item => item && typeof item.class_th === 'string')
        .map(item => ({ className: String(item.class_th), category: 'Masterlist' }))
      : []
    const hazards = sdsHazards.length > 0 ? sdsHazards : masterlistHazards
    const packageValue = numberOrNull(holding.package_value)
    const packageUnit = text(holding.package_unit)
    const currentContainerCount = numberOrNull(holding.current_container_count)
    const storedCalculatedValue = numberOrNull(holding.calculated_total_value)
    const storedCalculatedUnit = text(holding.calculated_total_unit)
    const storedCalculated = storedCalculatedValue != null && isQuantityUnit(storedCalculatedUnit)
      ? { value: storedCalculatedValue, unit: storedCalculatedUnit }
      : null
    // Keep the imported total when it exists because a holding can contain
    // mixed package sizes. Derive it for existing/new rows that do not have a
    // persisted total so the UI never needs a manually entered total.
    // An imported row may have been marked unsupported before an operator
    // corrected its package fields. Once the current holding has a valid
    // value/unit/count, calculate from those current fields instead of
    // letting the stale import warning hide the corrected quantity.
    const calculated = calculateRegistryQuantity({
      packageValue,
      packageUnit,
      currentContainerCount,
      importEvidence,
      stored: storedCalculated,
    })
    const row: ChemicalRegistryRow = {
      productId: String(product.id),
      holdingId: String(holding.id),
      publicId: String(product.public_id),
      canonicalName: String(product.canonical_name),
      aliases: aliasesByProduct.get(product.id) ?? [],
      casNumber: text(product.cas_number),
      concentration: text(product.concentration),
      storageScope: placement.storageScope,
      workflowOrigin: holding.workflow_origin === 'registry_v2' ? 'registry_v2' : 'current',
      inventoryCaptureStatus: holding.inventory_capture_status === 'sds_only' ? 'sds_only' : 'complete',
      roomId: room?.id == null ? null : String(room.id),
      locationId: placement.locationId,
      packageValue,
      packageUnit: isQuantityUnit(packageUnit) ? packageUnit : null,
      packageRaw: importedPackageRaw(importEvidence),
      currentContainerCount,
      minimumStock: numberOrNull(holding.minimum_stock),
      lotNumber: text(holding.lot_number),
      reportedTotalRaw: text(holding.reported_total_raw),
      calculatedTotalValue: calculated?.value ?? null,
      calculatedTotalUnit: calculated?.unit ?? null,
      receivedOn: text(holding.received_on),
      openedOn: text(holding.opened_on),
      expiresOn: text(holding.expires_on),
      effectiveOn: text(holding.effective_on),
      quantityConflict: Array.isArray(importEvidence?.conflict_codes)
        && importEvidence.conflict_codes.some((code: unknown) => ['quantity_unit_unsupported', 'container_count_unknown', 'minimum_stock_unknown'].includes(String(code))),
      positionCode: placement.positionCode,
      unitId: String(unit.id),
      unitName: String(unit.name_th),
      lifecycleStatus: product.lifecycle_status === 'retired' ? 'retired' : 'active',
      sdsStatus,
      sdsWorkflowStatus: selectedVersion?.status ?? null,
      hasSdsFile: holdingVersions.some(item => item.file_id != null && String(item.file_id).trim() !== ''),
      sdsVersionId: selectedVersion ? String(selectedVersion.id) : null,
      publicationStatus,
      publicationDestination: placement.storageScope,
      pictogramCodes: pictograms,
      signalWord: approved ? text(approved.signal_word) : null,
      hazards,
      hStatements: approved && Array.isArray(approved.h_statements) ? approved.h_statements : [],
      updatedAt: String(holding.updated_at),
    }
    const haystack = [row.canonicalName, row.casNumber, row.concentration, ...row.aliases].filter(Boolean).join(' ').toLocaleLowerCase('th')
    if (filters.q && !haystack.includes(filters.q.toLocaleLowerCase('th'))) continue
    if (filters.unitId && row.unitId !== filters.unitId) continue
    if (filters.roomId && room?.id !== filters.roomId) continue
    if (filters.positionCode && row.positionCode !== filters.positionCode) continue
    if (filters.sdsStatus && row.sdsStatus !== filters.sdsStatus) continue
    if (filters.ghs && !row.pictogramCodes.includes(filters.ghs)) continue
    if (filters.lifecycle && product.lifecycle_status !== filters.lifecycle) continue
    rows.push(row)
  }
  return rows.sort((a, b) => (
    a.storageScope.localeCompare(b.storageScope)
    || (a.positionCode ?? '').localeCompare(b.positionCode ?? '', 'en')
    || a.canonicalName.localeCompare(b.canonicalName, 'th')
    || a.holdingId.localeCompare(b.holdingId)
  ))
}

export function listChemicalRegistry(filters: ChemicalRegistryFilters = {}) {
  return listChemicalRegistryWithSource(databaseSource, filters)
}

export async function getChemicalSafetyDashboard() {
  const snapshot = await databaseSource.loadSnapshot()
  const registry = await listChemicalRegistryWithSource({ loadSnapshot: async () => snapshot })
  return {
    products: new Set(registry.map(row => row.productId)).size,
    positions: new Set(registry.map(row => row.positionCode).filter(Boolean)).size,
    plausibleCandidates: snapshot.importRows.filter(row => row.match_status === 'candidate').length,
    mismatches: snapshot.importRows.filter(row => row.match_status === 'mismatch').length,
    missing: snapshot.importRows.filter(row => row.match_status === 'missing').length,
    quantityConflicts: registry.filter(row => row.quantityConflict).length,
    pendingReview: snapshot.pendingChanges.filter(row => row.status === 'in_review').length
      + snapshot.sdsVersions.filter(row => row.status === 'in_review').length,
  }
}

export async function getChemicalStorageLayout(roomCode: string): Promise<ChemicalStorageLocationDTO[]> {
  const snapshot = await databaseSource.loadSnapshot()
  const room = snapshot.rooms.find(item => item.code === roomCode)
  if (!room) return []
  return snapshot.locations.filter(item => item.room_id === room.id && item.active !== false).map(item => ({
    id: String(item.id), roomId: String(item.room_id), code: String(item.code), zoneCode: item.zone_code,
    locationKind: item.location_kind, displayOrder: Number(item.display_order), displayGeometry: item.display_geometry ?? null,
    active: Boolean(item.active),
  })).sort((a, b) => a.displayOrder - b.displayOrder)
}

export async function listChemicalRooms(): Promise<ChemicalRoomDTO[]> {
  const { data, error } = await supabaseAdmin
    .from('chemical_rooms')
    .select('id, code, name_th, map_space_code, active, created_at, updated_at')
    .eq('active', true)
    .order('name_th')
  if (error) throw new Error(`chemical_rooms: ${error.message}`)
  return (data ?? []).map(row => ({
    id: String(row.id),
    code: String(row.code),
    nameTh: String(row.name_th),
    mapSpaceCode: row.map_space_code == null ? null : String(row.map_space_code),
    active: Boolean(row.active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }))
}

export async function listChemicalImportReview(filters: ImportReviewFilters = {}): Promise<ChemicalImportRowDTO[]> {
  const snapshot = await databaseSource.loadSnapshot()
  return snapshot.importRows.filter(row => {
    if (filters.batchId && row.batch_id !== filters.batchId) return false
    if (filters.matchStatus && row.match_status !== filters.matchStatus) return false
    if (filters.q && !JSON.stringify([row.row_key, row.raw_data, row.normalized_data]).toLocaleLowerCase('th').includes(filters.q.toLocaleLowerCase('th'))) return false
    return true
  }).map(row => ({
    id: String(row.id), batchId: String(row.batch_id), rowKey: String(row.row_key), rawData: jsonObject(row.raw_data),
    normalizedData: row.normalized_data ? jsonObject(row.normalized_data) : null, matchStatus: row.match_status,
    conflictCodes: stringArray(row.conflict_codes), targetProductId: text(row.target_product_id), decisionNote: text(row.decision_note),
    decidedBy: text(row.decided_by), decidedAt: text(row.decided_at), createdAt: String(row.created_at),
  }))
}

/** รายการคำขอแก้ไข/เพิ่ม/เลิกใช้งานสารเคมี สำหรับแผงประวัติการเปลี่ยนแปลง */
export async function listChemicalChangeRequests(): Promise<ChemicalChangeRequestListItemDTO[]> {
  const snapshot = await databaseSource.loadSnapshot()
  const productById = new Map(snapshot.products.map(row => [row.id, row]))
  const holdingById = new Map(snapshot.holdings.map(row => [row.id, row]))
  const unitById = new Map(snapshot.units.map(row => [row.id, row]))

  return snapshot.pendingChanges
    .filter(row => row.status !== 'approved' && row.status !== 'rejected')
    .map(row => {
      const unit = unitById.get(row.unit_id)
      let productName: string | null = null
      if (row.entity_type === 'product') {
        productName = productById.get(row.entity_id)?.canonical_name ?? null
      } else if (row.entity_type === 'holding' || row.entity_type === 'holding_delete') {
        const holding = holdingById.get(row.entity_id)
        productName = holding ? productById.get(holding.product_id)?.canonical_name ?? null : null
      } else {
        const proposedProductId = typeof row.proposed_data?.product_id === 'string' ? row.proposed_data.product_id : null
        productName = proposedProductId
          ? productById.get(proposedProductId)?.canonical_name ?? null
          : typeof row.proposed_data?.canonical_name === 'string' ? row.proposed_data.canonical_name : null
      }
      return {
        id: String(row.id),
        entityType: row.entity_type,
        entityId: row.entity_id ? String(row.entity_id) : null,
        unitId: String(row.unit_id),
        proposedData: camelProposal(jsonObject(row.proposed_data)),
        status: row.status,
        submittedBy: text(row.submitted_by),
        submittedAt: text(row.submitted_at),
        reviewedBy: text(row.reviewed_by),
        reviewedAt: text(row.reviewed_at),
        reviewReason: text(row.review_reason),
        createdBy: text(row.created_by),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        productName,
        unitName: unit ? String(unit.name_th) : 'ไม่ทราบหน่วยงาน',
      } satisfies ChemicalChangeRequestListItemDTO
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

/**
 * สารเคมีทั้งหมดแบบดิบ (รวมที่เลิกใช้งานแล้ว) — ใช้เติมฟอร์มแก้ไขข้อมูลสาร/สลับสถานะใช้งาน
 * ต้องรวม retired ด้วย ไม่งั้นสารที่เพิ่งเลิกใช้งานจะกดแก้ไข/เปิดใช้งานคืนไม่ได้อีกเลย
 */
export async function listChemicalProductRecords(): Promise<ChemicalProductDTO[]> {
  const products = await selectAll('chemical_products')
  return products
    .map(row => ({
      id: String(row.id),
      publicId: String(row.public_id),
      canonicalName: String(row.canonical_name),
      casNumber: text(row.cas_number),
      manufacturer: text(row.manufacturer),
      supplier: text(row.supplier),
      productCode: text(row.product_code),
      concentration: text(row.concentration),
      physicalState: (text(row.physical_state) as ChemicalPhysicalState | null),
      lifecycleStatus: (row.lifecycle_status === 'retired' ? 'retired' : 'active') as 'active' | 'retired',
      ghsSourceText: text(row.ghs_source_text),
      ghsPictogramCodes: stringArray(row.ghs_pictogram_codes) as GhsPictogramCode[],
      ghsHazardClasses: Array.isArray(row.ghs_hazard_classes)
        ? (row.ghs_hazard_classes as Array<Record<string, unknown>>)
          .filter(item => item && typeof item.class_th === 'string' && typeof item.class_en === 'string')
          .map(item => ({ classTh: String(item.class_th), classEn: String(item.class_en) }))
        : [],
      createdBy: text(row.created_by),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
    }))
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'th'))
}

export async function listInternalSds(filters: InternalSdsFilters = {}, scope: 'all' | 'room' = 'all'): Promise<ChemicalSdsDTO[]> {
  const snapshot = await databaseSource.loadSnapshot()
  const roomVersionIds = scope === 'room'
    ? roomChemicalSdsVersionIds(
      snapshot.sdsVersions,
      snapshot.holdings,
      snapshot.sdsDepartmentLinks,
      snapshot.sdsPublications,
    )
    : null
  const linkedHoldingIdsByVersion = new Map<string, string[]>()
  for (const link of snapshot.sdsDepartmentLinks) {
    if (link.sds_version_id == null || link.holding_id == null) continue
    const versionId = String(link.sds_version_id)
    linkedHoldingIdsByVersion.set(versionId, [
      ...(linkedHoldingIdsByVersion.get(versionId) ?? []),
      String(link.holding_id),
    ])
  }
  for (const publication of snapshot.sdsPublications) {
    if (publication.sds_version_id == null || publication.source_holding_id == null) continue
    const versionId = String(publication.sds_version_id)
    const holdingId = String(publication.source_holding_id)
    const relatedHoldingIds = linkedHoldingIdsByVersion.get(versionId) ?? []
    if (!relatedHoldingIds.includes(holdingId)) relatedHoldingIds.push(holdingId)
    linkedHoldingIdsByVersion.set(versionId, relatedHoldingIds)
  }
  for (const version of snapshot.sdsVersions) {
    const sharedHoldingIds = sharedDepartmentHoldingIdsForVersion(
      version,
      snapshot.holdings,
      snapshot.sdsDepartmentLinks,
      snapshot.sdsPublications,
    )
    if (sharedHoldingIds.size === 0) continue
    const versionId = String(version.id)
    const relatedHoldingIds = linkedHoldingIdsByVersion.get(versionId) ?? []
    for (const holdingId of sharedHoldingIds) {
      if (!relatedHoldingIds.includes(holdingId)) relatedHoldingIds.push(holdingId)
    }
    linkedHoldingIdsByVersion.set(versionId, relatedHoldingIds)
  }
  return snapshot.sdsVersions.filter(row => {
    if (roomVersionIds && !roomVersionIds.has(String(row.id))) return false
    if (filters.unitId) {
      const sourceHoldingId = row.source_holding_id ? String(row.source_holding_id) : null
      const linkedHoldingIds = linkedHoldingIdsByVersion.get(String(row.id)) ?? []
      const relatedHoldingIds = [
        ...(sourceHoldingId ? [sourceHoldingId] : []),
        ...linkedHoldingIds,
      ]
      const compatibleUnit = relatedHoldingIds.some(holdingId => snapshot.holdings.some(holding => (
        String(holding.id) === holdingId
        && String(holding.unit_id) === filters.unitId
        && (scope !== 'room' || holding.storage_scope === 'room')
      )))
      if (!compatibleUnit) return false
    }
    if (filters.productId && row.product_id !== filters.productId) return false
    if (filters.status && row.status !== filters.status) return false
    const product = snapshot.products.find(item => item.id === row.product_id)
    if (filters.q && !JSON.stringify([product?.canonical_name, row.manufacturer, row.supplier, row.product_code]).toLocaleLowerCase('th').includes(filters.q.toLocaleLowerCase('th'))) return false
    return true
  }).map(row => mapSds(row, snapshot.sdsHazards, linkedHoldingIdsByVersion.get(String(row.id)) ?? [])).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
