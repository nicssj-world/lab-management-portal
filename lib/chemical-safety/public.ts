import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { CHEMICAL_SDS_DEPARTMENTS } from './departments'
import {
  CHEMICAL_GROUP_SUMMARY,
  CHEMICAL_LAYOUT_UPDATED_LABEL,
  CHEMICAL_ROOM_NAME_TH,
  CHEMICAL_ZONE_META,
} from './storage-manifest'
import type { GhsPictogramCode } from './types'
import type {
  PublicDepartmentSdsGroup,
  PublicSdsFile,
  PublicSdsFilters,
  PublicSdsResult,
  PublicStorageCabinet,
  PublicStorageLayout,
} from './public-types'

type Row = Record<string, any>

const CHEMICAL_ROOM_CODE = 'chemical-prep'

async function rows(table: string, configure?: (query: any) => any): Promise<Row[]> {
  let query: any = (supabaseAdmin.from(table) as any).select('*')
  if (configure) query = configure(query)
  const { data, error } = await query
  if (error) throw new Error(`${table}: ${error.message}`)
  return data ?? []
}

function pictogramList(value: unknown): GhsPictogramCode[] {
  return Array.isArray(value) ? value.filter((item): item is GhsPictogramCode => typeof item === 'string') : []
}

async function loadPublicRows() {
  const [products, aliases, unitProducts, units, versions, holdings, locations, rooms] = await Promise.all([
    rows('chemical_products', query => query.eq('lifecycle_status', 'active')),
    rows('chemical_product_aliases'),
    rows('chemical_unit_products', query => query.eq('active', true).eq('public_eligible', true)),
    rows('chemical_units', query => query.eq('active', true)),
    rows('chemical_sds_versions', query => query.eq('status', 'approved')),
    rows('chemical_inventory_holdings'),
    rows('chemical_storage_locations', query => query.eq('active', true)),
    rows('chemical_rooms', query => query.eq('code', CHEMICAL_ROOM_CODE)),
  ])
  return { products, aliases, unitProducts, units, versions, holdings, locations, rooms }
}

export async function searchPublicSds(filters: PublicSdsFilters = {}): Promise<PublicSdsResult[]> {
  const data = await loadPublicRows()

  const aliasByProduct = new Map<string, string[]>()
  for (const alias of data.aliases) {
    aliasByProduct.set(alias.product_id, [...(aliasByProduct.get(alias.product_id) ?? []), String(alias.alias)])
  }

  const unitById = new Map(data.units.map(unit => [unit.id, unit]))
  const publishedUnits = new Map<string, Array<{ code: string; name: string }>>()
  for (const link of data.unitProducts) {
    const unit = unitById.get(link.unit_id)
    if (!unit) continue
    const values = publishedUnits.get(link.product_id) ?? []
    if (!values.some(item => item.code === unit.code)) {
      values.push({ code: String(unit.code), name: String(unit.name_th) })
    }
    publishedUnits.set(link.product_id, values)
  }

  const versionByProduct = new Map(data.versions.map(version => [version.product_id, version]))

  // ตำแหน่งจัดเก็บมาจาก holding ไม่ใช่จาก product — สารตัวเดียวอาจถูกเก็บได้หลายที่
  const locationById = new Map(data.locations.map(location => [location.id, location]))
  const positionByProduct = new Map<string, { code: string; zoneCode: string }>()
  for (const holding of data.holdings) {
    if (positionByProduct.has(holding.product_id)) continue
    const location = locationById.get(holding.location_id)
    if (!location) continue
    positionByProduct.set(holding.product_id, {
      code: String(location.code),
      zoneCode: String(location.zone_code),
    })
  }

  const results: PublicSdsResult[] = []
  for (const product of data.products) {
    const units = publishedUnits.get(product.id) ?? []
    // เกณฑ์เดียวของการขึ้นหน้าสาธารณะคือ "มีหน่วยงานที่เผยแพร่ได้"
    // เอกสาร SDS ที่อนุมัติแล้วเป็นของแถม ไม่ใช่เงื่อนไข — ข้อมูล GHS มีประโยชน์แม้ไฟล์ยังไม่พร้อม
    if (units.length === 0) continue

    const version = versionByProduct.get(product.id)
    const statements = version && Array.isArray(version.h_statements)
      ? version.h_statements.filter((item: any) => item && typeof item.code === 'string' && typeof item.text === 'string')
      : []

    // GHS จากเอกสาร SDS ที่ผ่านการทบทวนแล้วชนะเสมอ ถ้าไม่มีจึงใช้ค่าจาก master list
    const sdsPictograms = version ? pictogramList(version.pictogram_codes) : []
    const masterlistPictograms = pictogramList(product.ghs_pictogram_codes)
    const useSdsGhs = sdsPictograms.length > 0
    const hazardClassesTh = Array.isArray(product.ghs_hazard_classes)
      ? product.ghs_hazard_classes
          .map((hazard: any) => (hazard && typeof hazard.class_th === 'string' ? hazard.class_th : null))
          .filter((value: string | null): value is string => value !== null)
      : []

    const publicId = String(product.public_id)
    const approved = Boolean(version?.file_id)
    const position = positionByProduct.get(product.id) ?? null

    const item: PublicSdsResult = {
      publicId,
      canonicalName: String(product.canonical_name),
      aliases: aliasByProduct.get(product.id) ?? [],
      casNumber: product.cas_number ?? null,
      concentration: version?.concentration ?? product.concentration ?? null,
      manufacturer: version?.manufacturer ?? product.manufacturer ?? null,
      supplier: version?.supplier ?? product.supplier ?? null,
      productCode: version?.product_code ?? product.product_code ?? null,
      units: units.sort((a, b) => a.name.localeCompare(b.name, 'th')),
      language: version?.language || 'th',
      revisionLabel: version?.revision_label ?? null,
      effectiveOn: version?.effective_on ?? null,
      signalWord: version?.signal_word ?? null,
      pictogramCodes: useSdsGhs ? sdsPictograms : masterlistPictograms,
      ghsSource: useSdsGhs ? 'sds' : 'masterlist',
      hazardClassesTh,
      hCodes: statements.map((statement: any) => statement.code),
      hazardStatements: statements,
      sourceUrl: version?.source_url ?? null,
      sdsStatus: approved ? 'approved' : 'pending',
      positionCode: position?.code ?? null,
      zoneCode: position?.zoneCode ?? null,
      viewUrl: approved ? `/api/public/sds/${publicId}/file?disposition=inline` : null,
      downloadUrl: approved ? `/api/public/sds/${publicId}/file?disposition=attachment` : null,
    }

    const haystack = JSON.stringify([
      item.canonicalName, item.aliases, item.casNumber, item.manufacturer,
      item.supplier, item.units, item.hazardClassesTh, item.positionCode,
    ]).toLocaleLowerCase('th')
    if (filters.q && !haystack.includes(filters.q.toLocaleLowerCase('th'))) continue
    if (filters.unit && !item.units.some(unit => unit.code === filters.unit || unit.name === filters.unit)) continue
    if (filters.language && item.language !== filters.language) continue
    if (filters.ghs && !item.pictogramCodes.includes(filters.ghs)) continue
    if (filters.zone && item.zoneCode !== filters.zone) continue
    if (filters.position && item.positionCode !== filters.position) continue
    if (filters.productIds && !filters.productIds.includes(publicId)) continue
    results.push(item)
  }

  return results.sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'th'))
}

/**
 * ผังตู้เก็บสารเคมีสำหรับหน้าสาธารณะ
 * แสดงชื่อสารและสัญลักษณ์ GHS เท่านั้น — ไม่มีปริมาณคงคลัง lot หรือขั้นต่ำ
 */
export async function getPublicStorageLayout(): Promise<PublicStorageLayout> {
  const data = await loadPublicRows()
  const room = data.rooms[0] ?? null

  const productById = new Map(data.products.map(product => [product.id, product]))
  const eligibleProductIds = new Set(data.unitProducts.map(link => link.product_id))
  const versionByProduct = new Map(data.versions.map(version => [version.product_id, version]))

  const cabinets = new Map<string, PublicStorageCabinet>()
  for (const location of data.locations) {
    if (room && location.room_id !== room.id) continue
    cabinets.set(String(location.id), {
      code: String(location.code),
      zoneCode: String(location.zone_code),
      locationKind: String(location.location_kind),
      displayOrder: Number(location.display_order),
      chemicals: [],
    })
  }

  const seen = new Set<string>()
  for (const holding of data.holdings) {
    const cabinet = cabinets.get(String(holding.location_id))
    const product = productById.get(holding.product_id)
    if (!cabinet || !product || !eligibleProductIds.has(product.id)) continue

    const key = `${holding.location_id}::${product.id}`
    if (seen.has(key)) continue
    seen.add(key)

    const version = versionByProduct.get(product.id)
    const sdsPictograms = version ? pictogramList(version.pictogram_codes) : []
    cabinet.chemicals.push({
      publicId: String(product.public_id),
      name: String(product.canonical_name),
      pictogramCodes: sdsPictograms.length > 0 ? sdsPictograms : pictogramList(product.ghs_pictogram_codes),
    })
  }

  for (const cabinet of cabinets.values()) {
    cabinet.chemicals.sort((a, b) => a.name.localeCompare(b.name, 'th'))
  }

  const byCode = [...cabinets.values()].sort((a, b) => a.displayOrder - b.displayOrder)

  return {
    roomNameTh: room?.name_th ? String(room.name_th) : CHEMICAL_ROOM_NAME_TH,
    updatedLabel: CHEMICAL_LAYOUT_UPDATED_LABEL,
    zones: CHEMICAL_ZONE_META.map(zone => ({
      code: zone.code,
      titleTh: zone.titleTh,
      color: zone.color,
      displayRow: zone.displayRow,
      cabinets: byCode.filter(cabinet => cabinet.zoneCode === zone.code),
    })),
    groupSummary: CHEMICAL_GROUP_SUMMARY.map(row => ({
      groupTh: row.groupTh,
      locationCodes: [...row.locationCodes],
    })),
  }
}

/** คลังเอกสาร SDS ของงานที่หัวหน้างานกดเผยแพร่แล้วเท่านั้น */
export async function listPublicDepartmentSds(): Promise<PublicDepartmentSdsGroup[]> {
  const departments = await rows('chemical_sds_departments', query => query.eq('status', 'published'))
  if (departments.length === 0) return []

  const codes = departments.map(row => String(row.code))
  const items = await rows('chemical_department_sds', query => query.in('department_code', codes))

  const byDepartment = new Map<string, PublicDepartmentSdsGroup['items']>()
  for (const item of items) {
    const list = byDepartment.get(String(item.department_code)) ?? []
    list.push({ publicId: String(item.public_id), displayName: String(item.display_name) })
    byDepartment.set(String(item.department_code), list)
  }

  const orderByCode = new Map(CHEMICAL_SDS_DEPARTMENTS.map((item, index) => [item.code, index]))
  return departments
    .map(row => ({
      code: String(row.code),
      department: String(row.department),
      items: (byDepartment.get(String(row.code)) ?? []).sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'th', { numeric: true }),
      ),
    }))
    .filter(group => group.items.length > 0)
    .sort((a, b) => (orderByCode.get(a.code) ?? 99) - (orderByCode.get(b.code) ?? 99))
}

export async function getPublicSdsFile(publicId: string): Promise<PublicSdsFile | null> {
  const { data: product } = await supabaseAdmin
    .from('chemical_products').select('id').eq('public_id', publicId).eq('lifecycle_status', 'active').maybeSingle()
  if (!product) return null
  const { data: links } = await supabaseAdmin
    .from('chemical_unit_products').select('unit_id').eq('product_id', product.id).eq('active', true).eq('public_eligible', true)
  if (!links?.length) return null
  const { data: version } = await supabaseAdmin
    .from('chemical_sds_versions').select('file_id').eq('product_id', product.id).eq('status', 'approved').maybeSingle()
  if (!version?.file_id) return null
  const { data: file } = await supabaseAdmin
    .from('chemical_sds_files').select('r2_key, file_name, content_type').eq('id', version.file_id).maybeSingle()
  if (!file || file.content_type !== 'application/pdf') return null
  return { r2Key: file.r2_key, fileName: file.file_name, contentType: 'application/pdf' }
}

/** ไฟล์ของงานเปิดได้ต่อเมื่องานนั้นถูกเผยแพร่แล้ว — ตรวจซ้ำที่นี่ ไม่พึ่ง UI */
export async function getPublicDepartmentSdsFile(publicId: string): Promise<PublicSdsFile | null> {
  const { data: entry } = await supabaseAdmin
    .from('chemical_department_sds')
    .select('file_id, department_code')
    .eq('public_id', publicId)
    .maybeSingle()
  if (!entry) return null

  const { data: department } = await supabaseAdmin
    .from('chemical_sds_departments')
    .select('status')
    .eq('code', entry.department_code)
    .maybeSingle()
  if (department?.status !== 'published') return null

  const { data: file } = await supabaseAdmin
    .from('chemical_sds_files')
    .select('r2_key, file_name, content_type')
    .eq('id', entry.file_id)
    .maybeSingle()
  if (!file || file.content_type !== 'application/pdf') return null
  return { r2Key: file.r2_key, fileName: file.file_name, contentType: 'application/pdf' }
}
