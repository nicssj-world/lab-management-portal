import 'server-only'

import { detectQuantityConflict, currentSdsState } from './domain'
import type {
  ChemicalImportRowDTO,
  ChemicalRegistryFilters,
  ChemicalRegistryRow,
  ChemicalSdsDTO,
  ChemicalSdsHazardDTO,
  ChemicalStorageLocationDTO,
  GhsPictogramCode,
  JsonValue,
  QuantityUnit,
} from './types'
import type { ImportReviewFilters, InternalSdsFilters } from './schemas'
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
    const [products, aliases, units, unitProducts, holdings, rooms, locations, sdsVersions, sdsHazards, importRows, importBatches, pendingChanges] = await Promise.all([
      selectAll('chemical_products'),
      selectAll('chemical_product_aliases'),
      selectAll('chemical_units'),
      selectAll('chemical_unit_products'),
      selectAll('chemical_inventory_holdings'),
      selectAll('chemical_rooms'),
      selectAll('chemical_storage_locations'),
      selectAll('chemical_sds_versions'),
      selectAll('chemical_sds_hazards'),
      selectAll('chemical_import_rows'),
      selectAll('chemical_import_batches'),
      selectAll('chemical_change_requests'),
    ])
    return { products, aliases, units, unitProducts, holdings, rooms, locations, sdsVersions, sdsHazards, importRows, importBatches, pendingChanges }
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

function mapSds(row: Row, hazards: Row[]): ChemicalSdsDTO {
  return {
    id: String(row.id),
    productId: String(row.product_id),
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
    const room = location ? roomById.get(location.room_id) : null
    if (!product || !unit || !unitProduct) continue
    const versions = sdsByProduct.get(product.id) ?? []
    const approved = versions.find(item => item.status === 'approved')
    const draft = versions.find(item => item.status === 'draft' || item.status === 'in_review')
    const importEvidence = snapshot.importRows.find(item => item.target_product_id === product.id)
    const sdsStatus = currentSdsState({
      status: approved ? 'approved' : draft ? draft.status : null,
      reviewDueOn: approved ? text(approved.review_due_on) : null,
      matchStatus: approved || draft ? null : importEvidence?.match_status ?? 'missing',
    }, today)
    const pictograms = approved ? stringArray(approved.pictogram_codes) as GhsPictogramCode[] : []
    const hazards = approved ? snapshot.sdsHazards.filter(item => item.sds_version_id === approved.id).map(item => ({
      className: String(item.hazard_class), category: String(item.hazard_category),
    })) : []
    const calculatedValue = numberOrNull(holding.calculated_total_value)
    const calculatedUnit = text(holding.calculated_total_unit) as QuantityUnit | null
    const row: ChemicalRegistryRow = {
      productId: String(product.id),
      publicId: String(product.public_id),
      canonicalName: String(unitProduct.preferred_name || product.canonical_name),
      aliases: aliasesByProduct.get(product.id) ?? [],
      casNumber: text(product.cas_number),
      concentration: text(product.concentration),
      packageValue: numberOrNull(holding.package_value),
      packageUnit: text(holding.package_unit) as QuantityUnit | null,
      currentContainerCount: numberOrNull(holding.current_container_count),
      minimumStock: numberOrNull(holding.minimum_stock),
      reportedTotalRaw: text(holding.reported_total_raw),
      calculatedTotalValue: calculatedValue,
      calculatedTotalUnit: calculatedUnit,
      quantityConflict: calculatedValue != null && calculatedUnit != null
        ? detectQuantityConflict({ calculated: { value: calculatedValue, unit: calculatedUnit }, reportedRaw: text(holding.reported_total_raw) ?? '' })
        : Boolean(holding.reported_total_raw),
      positionCode: location ? String(location.code) : null,
      unitId: String(unit.id),
      unitName: String(unit.name_th),
      sdsStatus,
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
  return rows.sort((a, b) => a.positionCode?.localeCompare(b.positionCode ?? '', 'en') || a.canonicalName.localeCompare(b.canonicalName, 'th'))
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

export async function listInternalSds(filters: InternalSdsFilters = {}): Promise<ChemicalSdsDTO[]> {
  const snapshot = await databaseSource.loadSnapshot()
  const productIdsForUnit = filters.unitId
    ? new Set(snapshot.unitProducts.filter(row => row.unit_id === filters.unitId).map(row => row.product_id))
    : null
  return snapshot.sdsVersions.filter(row => {
    if (filters.productId && row.product_id !== filters.productId) return false
    if (productIdsForUnit && !productIdsForUnit.has(row.product_id)) return false
    if (filters.status && row.status !== filters.status) return false
    const product = snapshot.products.find(item => item.id === row.product_id)
    if (filters.q && !JSON.stringify([product?.canonical_name, row.manufacturer, row.supplier, row.product_code]).toLocaleLowerCase('th').includes(filters.q.toLocaleLowerCase('th'))) return false
    return true
  }).map(row => mapSds(row, snapshot.sdsHazards)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
