export interface ChemicalHoldingSdsVisibilityRow {
  id?: unknown
  product_id?: unknown
  unit_id?: unknown
  storage_scope?: unknown
}

export interface ChemicalSdsVisibilityVersionRow {
  id?: unknown
  product_id?: unknown
  source_holding_id?: unknown
}

export interface ChemicalDepartmentSdsVisibilityLinkRow {
  department_sds_id?: unknown
  product_id?: unknown
  sds_version_id?: unknown
  holding_id?: unknown
}

export interface ChemicalSdsPublicationVisibilityRow {
  sds_version_id?: unknown
  source_holding_id?: unknown
  destination?: unknown
}

/**
 * Department holdings use the product as their shared chemical identity.
 * Resolve the department holdings that may read one SDS version without
 * allowing a department document to cross into the room-storage scope.
 */
export function sharedDepartmentHoldingIdsForVersion(
  version: ChemicalSdsVisibilityVersionRow,
  holdings: ChemicalHoldingSdsVisibilityRow[],
  departmentLinks: ChemicalDepartmentSdsVisibilityLinkRow[] = [],
  publications: ChemicalSdsPublicationVisibilityRow[] = [],
): Set<string> {
  if (version.id == null || version.product_id == null) return new Set()

  const productId = String(version.product_id)
  const departmentHoldingIds = new Set(
    holdings
      .filter(holding => holding.id != null
        && holding.product_id != null
        && String(holding.product_id) === productId
        && holding.storage_scope === 'department')
      .map(holding => String(holding.id)),
  )
  if (departmentHoldingIds.size === 0) return new Set()

  const versionId = String(version.id)
  const sourceHoldingIsDepartment = version.source_holding_id != null
    && departmentHoldingIds.has(String(version.source_holding_id))
  const linkedToDepartment = departmentLinks.some(link => (
    link.sds_version_id != null
      && String(link.sds_version_id) === versionId
      && link.holding_id != null
      && departmentHoldingIds.has(String(link.holding_id))
      && (link.product_id == null || String(link.product_id) === productId)
  ))
  const publishedToDepartment = publications.some(publication => (
    publication.sds_version_id != null
      && String(publication.sds_version_id) === versionId
      && publication.destination === 'department'
      && publication.source_holding_id != null
      && departmentHoldingIds.has(String(publication.source_holding_id))
  ))

  return sourceHoldingIsDepartment || linkedToDepartment || publishedToDepartment
    ? departmentHoldingIds
    : new Set()
}

/**
 * Return department SDS files that are backed by a department registry holding.
 *
 * The legacy department file table is still retained for the archive, so its
 * rows cannot be treated as public merely because a department is published.
 * A valid link must point to a department holding for the same product.
 */
export function linkedDepartmentSdsIds(
  links: ChemicalDepartmentSdsVisibilityLinkRow[],
  holdings: ChemicalHoldingSdsVisibilityRow[],
): Set<string> {
  const holdingById = new Map(
    holdings
      .filter(row => row.id != null)
      .map(row => [String(row.id), row]),
  )

  return new Set(
    links
      .filter(link => {
        if (link.department_sds_id == null || link.product_id == null || link.holding_id == null) return false
        const holding = holdingById.get(String(link.holding_id))
        return holding?.storage_scope === 'department'
          && holding.product_id != null
          && String(holding.product_id) === String(link.product_id)
      })
      .map(link => String(link.department_sds_id)),
  )
}

/**
 * Resolve the SDS versions owned by one registry holding.
 *
 * New registry rows point directly at the holding. Department holdings for
 * the same product intentionally share one SDS file, while room holdings stay
 * isolated so a department document cannot cross the storage-scope boundary.
 * Existing department rows may also point through links/publications after
 * their original source holding is deleted.
 */
export function sdsVersionIdsForHolding(
  versions: ChemicalSdsVisibilityVersionRow[],
  departmentLinks: ChemicalDepartmentSdsVisibilityLinkRow[],
  holdingId: string,
  publications: ChemicalSdsPublicationVisibilityRow[] = [],
  holdings: ChemicalHoldingSdsVisibilityRow[] = [],
): Set<string> {
  const linkedVersionIds = new Set(
    departmentLinks
      .filter(link => link.holding_id != null && String(link.holding_id) === holdingId && link.sds_version_id != null)
      .map(link => String(link.sds_version_id)),
  )
  const publishedVersionIds = new Set(
    publications
      .filter(publication => publication.source_holding_id != null
        && String(publication.source_holding_id) === holdingId
        && publication.sds_version_id != null)
      .map(publication => String(publication.sds_version_id)),
  )

  const targetHolding = holdings.find(holding => holding.id != null && String(holding.id) === holdingId)
  const sharedDepartmentVersionIds = targetHolding?.storage_scope === 'department'
    ? new Set(
      versions
        .filter(version => sharedDepartmentHoldingIdsForVersion(version, holdings, departmentLinks, publications).has(holdingId))
        .filter(version => version.id != null)
        .map(version => String(version.id)),
    )
    : new Set<string>()

  return new Set(
    versions
      .filter(version => version.id != null && (
        (version.source_holding_id != null && String(version.source_holding_id) === holdingId)
        || linkedVersionIds.has(String(version.id))
        || publishedVersionIds.has(String(version.id))
        || sharedDepartmentVersionIds.has(String(version.id))
      ))
      .map(version => String(version.id)),
  )
}

/**
 * SDS ห้องสารเคมีต้องอ้างอิงจากสารที่มี holding ในห้องจริงเท่านั้น
 * เพราะ chemical_sds_versions เป็นข้อมูลระดับ product และจึงอาจถูกสร้างจาก SDS แยกตามงานได้ด้วย
 */
export function roomChemicalProductIds(
  holdings: ChemicalHoldingSdsVisibilityRow[],
  unitId?: string,
): Set<string> {
  const scopesByProduct = new Map<string, Set<string>>()
  for (const row of holdings) {
    if (row.product_id == null || row.storage_scope == null) continue
    if (unitId != null && (row.unit_id == null || String(row.unit_id) !== unitId)) continue
    const scopes = scopesByProduct.get(String(row.product_id)) ?? new Set<string>()
    scopes.add(String(row.storage_scope))
    scopesByProduct.set(String(row.product_id), scopes)
  }

  return new Set(
    [...scopesByProduct.entries()]
      .filter(([, scopes]) => scopes.size === 1 && scopes.has('room'))
      .map(([productId]) => productId),
  )
}

/**
 * คืนเฉพาะ version ที่ควรแสดงในแผง SDS ห้องสารเคมี
 *
 * version รุ่นใหม่ผูกกับ holding โดยตรง ส่วน version เดิมอาจไม่มี
 * source_holding_id จึงต้องใช้ลิงก์ SDS แยกตามงานหรือ publication ที่ยังอ้างอิง
 * อยู่ก่อน และค่อย fallback ไปยัง product ที่มี holding ในห้องเพื่อรองรับข้อมูลเดิมเฉพาะกรณีที่
 * product นั้นไม่มี holding ของงานปนอยู่ด้วย ถ้ามีทั้งสอง scope ต้องรอการผูก
 * source holding อย่าง explicit ก่อน จึงจะนำมาแสดงได้
 */
export function roomChemicalSdsVersionIds(
  versions: ChemicalSdsVisibilityVersionRow[],
  holdings: ChemicalHoldingSdsVisibilityRow[],
  departmentLinks: ChemicalDepartmentSdsVisibilityLinkRow[] = [],
  publications: ChemicalSdsPublicationVisibilityRow[] = [],
): Set<string> {
  const holdingById = new Map(
    holdings
      .filter(row => row.id != null)
      .map(row => [String(row.id), row]),
  )
  const roomProducts = roomChemicalProductIds(holdings)
  const linksByVersion = new Map<string, string[]>()

  for (const link of departmentLinks) {
    if (link.sds_version_id == null || link.holding_id == null) continue
    const versionId = String(link.sds_version_id)
    const holdingIds = linksByVersion.get(versionId) ?? []
    const holdingId = String(link.holding_id)
    if (!holdingIds.includes(holdingId)) holdingIds.push(holdingId)
    linksByVersion.set(versionId, holdingIds)
  }

  for (const publication of publications) {
    if (publication.sds_version_id == null || publication.source_holding_id == null) continue
    const versionId = String(publication.sds_version_id)
    const holdingIds = linksByVersion.get(versionId) ?? []
    const holdingId = String(publication.source_holding_id)
    if (!holdingIds.includes(holdingId)) holdingIds.push(holdingId)
    linksByVersion.set(versionId, holdingIds)
  }

  const visible = new Set<string>()
  for (const version of versions) {
    if (version.id == null) continue
    const versionId = String(version.id)
    const sourceHoldingId = version.source_holding_id == null ? '' : String(version.source_holding_id)

    if (sourceHoldingId) {
      if (holdingById.get(sourceHoldingId)?.storage_scope === 'room') visible.add(versionId)
      if ((linksByVersion.get(versionId) ?? []).some(holdingId => holdingById.get(holdingId)?.storage_scope === 'room')) {
        visible.add(versionId)
      }
      continue
    }

    const linkedHoldingIds = linksByVersion.get(versionId) ?? []
    if (linkedHoldingIds.length > 0) {
      if (linkedHoldingIds.some(holdingId => holdingById.get(holdingId)?.storage_scope === 'room')) {
        visible.add(versionId)
      }
      continue
    }

    if (version.product_id != null && roomProducts.has(String(version.product_id))) visible.add(versionId)
  }

  return visible
}
