import 'server-only'

import { supabaseAdmin } from '@/lib/supabase/admin'
import { CHEMICAL_SDS_DEPARTMENTS, cleanSdsDisplayName } from './departments'
import {
  findRegisteredDepartmentChemicals,
  type RegisteredDepartmentChemical,
} from './department-registry'

export interface DepartmentSdsFileDTO {
  id: string
  source: 'legacy' | 'registry_v2'
  publicId: string
  displayName: string
  displayNameEdited: boolean
  sourcePath: string
  fileUrl: string
  registryLink: DepartmentSdsRegistryLinkDTO
}

export interface DepartmentSdsRegistryLinkDTO {
  status: 'unlinked' | 'pending' | 'registered' | 'linked'
  productId: string | null
  productName: string | null
  holdingId: string | null
  sdsVersionId: string | null
  candidates: DepartmentSdsRegistryCandidateDTO[]
}

export interface DepartmentSdsRegistryCandidateDTO {
  productId: string
  productName: string
  holdingId: string
  lotNumber: string | null
  packageValue: number | null
  packageUnit: string | null
  currentContainerCount: number | null
  availableToLink: boolean
}

export interface DepartmentSdsGroupDTO {
  code: string
  department: string
  archiveFolder: string
  status: 'draft' | 'published'
  publishedAt: string | null
  publishedByName: string | null
  fileCount: number
  files: DepartmentSdsFileDTO[]
  chemicalUnitId: string | null
}

/**
 * รายการคลังเอกสาร SDS ของทุกงานสำหรับหน้าเจ้าหน้าที่
 * คืนทุกงานเสมอแม้ยังไม่มีไฟล์ เพื่อให้เห็นว่างานไหนยังไม่ได้นำเข้า
 */
export async function listDepartmentSds(): Promise<DepartmentSdsGroupDTO[]> {
  const [departments, entries, publications, links, pendingRequests, units, products, unitProducts, holdings] = await Promise.all([
    supabaseAdmin.from('chemical_sds_departments').select('*').order('display_order'),
    supabaseAdmin.from('chemical_department_sds').select('*'),
    supabaseAdmin.from('chemical_sds_publications').select('*').eq('destination', 'department').eq('status', 'active'),
    supabaseAdmin.from('chemical_department_chemical_links').select('department_sds_id, product_id, holding_id, sds_version_id'),
    supabaseAdmin.from('chemical_change_requests').select('unit_id, status, proposed_data').eq('entity_type', 'department_chemical').in('status', ['draft', 'in_review']),
    supabaseAdmin.from('chemical_units').select('id, name_th').eq('active', true),
    supabaseAdmin
      .from('chemical_products')
      .select('id, canonical_name, lifecycle_status'),
    supabaseAdmin.from('chemical_unit_products').select('product_id, unit_id, preferred_name, active'),
    supabaseAdmin
      .from('chemical_inventory_holdings')
      .select('id, product_id, unit_id, storage_scope, lot_number, package_value, package_unit, current_container_count')
      .eq('storage_scope', 'department'),
  ])
  if (departments.error) throw new Error(`chemical_sds_departments: ${departments.error.message}`)
  if (entries.error) throw new Error(`chemical_department_sds: ${entries.error.message}`)
  if (publications.error) throw new Error(`chemical_sds_publications: ${publications.error.message}`)
  if (links.error) throw new Error(`chemical_department_chemical_links: ${links.error.message}`)
  if (pendingRequests.error) throw new Error(`chemical_change_requests: ${pendingRequests.error.message}`)
  if (units.error) throw new Error(`chemical_units: ${units.error.message}`)
  if (products.error) throw new Error(`chemical_products: ${products.error.message}`)
  if (unitProducts.error) throw new Error(`chemical_unit_products: ${unitProducts.error.message}`)
  if (holdings.error) throw new Error(`chemical_inventory_holdings: ${holdings.error.message}`)

  const productNames = new Map((products.data ?? []).map(row => [String(row.id), String(row.canonical_name)]))
  const activeProductIds = new Set(
    (products.data ?? [])
      .filter(row => row.lifecycle_status === 'active')
      .map(row => String(row.id)),
  )
  const unitByName = new Map((units.data ?? []).map(row => [String(row.name_th), String(row.id)]))
  const preferredNames = new Map(
    (unitProducts.data ?? []).map(row => [
      `${String(row.product_id)}:${String(row.unit_id)}`,
      typeof row.preferred_name === 'string' && row.preferred_name.trim() !== ''
        ? row.preferred_name
      : null,
    ]),
  )
  const unitProductKeys = new Set(
    (unitProducts.data ?? [])
      .filter(row => row.active === true)
      .map(row => `${String(row.product_id)}:${String(row.unit_id)}`),
  )
  const linkedHoldingIds = new Set((links.data ?? []).map(row => String(row.holding_id)))
  const registeredByUnit = new Map<string, RegisteredDepartmentChemical[]>()
  for (const holding of holdings.data ?? []) {
    const productId = String(holding.product_id)
    const unitId = String(holding.unit_id)
    const unitProductKey = `${productId}:${unitId}`
    if (!activeProductIds.has(productId)) continue
    if (!unitProductKeys.has(unitProductKey)) continue
    const productName = preferredNames.get(unitProductKey) ?? productNames.get(productId)
    if (!productName) continue
    const list = registeredByUnit.get(unitId) ?? []
    list.push({
      productId,
      productName,
      holdingId: String(holding.id),
      unitId,
      lotNumber: holding.lot_number == null ? null : String(holding.lot_number),
      packageValue: holding.package_value == null ? null : Number(holding.package_value),
      packageUnit: holding.package_unit == null ? null : String(holding.package_unit),
      currentContainerCount: holding.current_container_count == null ? null : Number(holding.current_container_count),
    })
    registeredByUnit.set(unitId, list)
  }
  const unitIdByDepartmentCode = new Map(
    CHEMICAL_SDS_DEPARTMENTS.map(definition => [
      definition.code,
      unitByName.get(definition.department) ?? null,
    ]),
  )
  const linkBySdsId = new Map((links.data ?? []).map(row => [String(row.department_sds_id), row]))
  const pendingBySdsId = new Map<string, any>()
  for (const request of pendingRequests.data ?? []) {
    const sourceId = request.proposed_data?.source_department_sds_id
    if (typeof sourceId === 'string') pendingBySdsId.set(sourceId, request)
  }

  const publisherIds = [...new Set(
    (departments.data ?? []).map(row => row.published_by).filter((value): value is string => Boolean(value)),
  )]
  const publishers = new Map<string, string>()
  if (publisherIds.length > 0) {
    const profiles = await supabaseAdmin.from('profiles').select('id, name').in('id', publisherIds)
    for (const profile of profiles.data ?? []) publishers.set(String(profile.id), String(profile.name ?? ''))
  }

  const byDepartment = new Map<string, DepartmentSdsFileDTO[]>()
  for (const entry of entries.data ?? []) {
    const list = byDepartment.get(String(entry.department_code)) ?? []
    list.push({
      id: String(entry.id),
      source: 'legacy',
      publicId: String(entry.public_id),
      displayName: String(entry.display_name),
      displayNameEdited: Boolean(entry.display_name_edited),
      sourcePath: String(entry.source_path),
      // เจ้าหน้าที่ต้องเปิดดูได้แม้งานยังเป็น draft; public route ต้องบล็อกไว้จนกว่าจะเผยแพร่
      fileUrl: `/api/admin/chemical-safety/department-sds/${entry.id}/file`,
      registryLink: (() => {
        const link = linkBySdsId.get(String(entry.id))
        if (link) {
          return {
            status: 'linked' as const,
            productId: String(link.product_id),
            productName: productNames.get(String(link.product_id)) ?? null,
            holdingId: String(link.holding_id),
            sdsVersionId: link.sds_version_id ? String(link.sds_version_id) : null,
            candidates: [],
          }
        }
        const pending = pendingBySdsId.get(String(entry.id))
        if (pending) {
          const productId = typeof pending.proposed_data?.product_id === 'string' ? pending.proposed_data.product_id : null
          return {
            status: 'pending' as const,
            productId,
            productName: productId ? productNames.get(productId) ?? null : typeof pending.proposed_data?.canonical_name === 'string' ? pending.proposed_data.canonical_name : null,
            holdingId: null,
            sdsVersionId: null,
            candidates: [],
          }
        }
        const registered = findRegisteredDepartmentChemicals(
          [String(entry.display_name), cleanSdsDisplayName(String(entry.source_path))],
          unitIdByDepartmentCode.get(String(entry.department_code)) ?? null,
          registeredByUnit.get(unitIdByDepartmentCode.get(String(entry.department_code)) ?? '') ?? [],
        )
        if (registered.length > 0) {
          const onlyMatch = registered.length === 1 ? registered[0] : null
          return {
            status: 'registered' as const,
            productId: onlyMatch?.productId ?? null,
            productName: onlyMatch?.productName ?? null,
            holdingId: onlyMatch?.holdingId ?? null,
            sdsVersionId: null,
            candidates: registered.map(candidate => ({
              productId: candidate.productId,
              productName: candidate.productName,
              holdingId: candidate.holdingId,
              lotNumber: candidate.lotNumber ?? null,
              packageValue: candidate.packageValue ?? null,
              packageUnit: candidate.packageUnit ?? null,
              currentContainerCount: candidate.currentContainerCount ?? null,
              availableToLink: !linkedHoldingIds.has(candidate.holdingId),
            })),
          }
        }
        return {
          status: 'unlinked' as const,
          productId: null,
          productName: null,
          holdingId: null,
          sdsVersionId: null,
          candidates: [],
        }
      })(),
    })
    byDepartment.set(String(entry.department_code), list)
  }

  for (const publication of publications.data ?? []) {
    const departmentCode = String(publication.department_code)
    const list = byDepartment.get(departmentCode) ?? []
    list.push({
      id: String(publication.id),
      source: 'registry_v2',
      publicId: String(publication.public_id),
      displayName: String(publication.display_name),
      displayNameEdited: false,
      sourcePath: 'registry-v2',
      fileUrl: `/api/admin/chemical-safety/sds/${publication.sds_version_id}/file`,
      registryLink: {
        status: 'linked',
        productId: String(publication.product_id),
        productName: productNames.get(String(publication.product_id)) ?? null,
        holdingId: String(publication.source_holding_id),
        sdsVersionId: String(publication.sds_version_id),
        candidates: [],
      },
    })
    byDepartment.set(departmentCode, list)
  }

  const seeded = new Map((departments.data ?? []).map(row => [String(row.code), row]))

  // ไล่จาก CHEMICAL_SDS_DEPARTMENTS เพื่อให้ลำดับคงที่และเห็นงานที่ยังไม่ได้ seed ลงฐานข้อมูล
  return CHEMICAL_SDS_DEPARTMENTS.map(definition => {
    const row = seeded.get(definition.code)
    const files = (byDepartment.get(definition.code) ?? [])
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'th', { numeric: true }))
    return {
      code: definition.code,
      department: definition.department,
      archiveFolder: definition.archiveFolder,
      status: row?.status === 'published' ? 'published' : 'draft',
      publishedAt: row?.published_at ? String(row.published_at) : null,
      publishedByName: row?.published_by ? publishers.get(String(row.published_by)) ?? null : null,
      fileCount: files.length,
      files,
      chemicalUnitId: unitByName.get(definition.department) ?? null,
    }
  })
}
