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
  sds_version_id?: unknown
  holding_id?: unknown
}

/**
 * Resolve the SDS versions owned by one registry holding.
 *
 * New registry rows point directly at the holding. Legacy department rows
 * point through chemical_department_chemical_links. Deliberately do not fall
 * back to product_id here: one product may be used by both a room and a
 * department, and that fallback is the source of the old cross-scope leak.
 */
export function sdsVersionIdsForHolding(
  versions: ChemicalSdsVisibilityVersionRow[],
  departmentLinks: ChemicalDepartmentSdsVisibilityLinkRow[],
  holdingId: string,
): Set<string> {
  const linkedVersionIds = new Set(
    departmentLinks
      .filter(link => link.holding_id != null && String(link.holding_id) === holdingId && link.sds_version_id != null)
      .map(link => String(link.sds_version_id)),
  )

  return new Set(
    versions
      .filter(version => version.id != null && (
        (version.source_holding_id != null && String(version.source_holding_id) === holdingId)
        || linkedVersionIds.has(String(version.id))
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
 * version รุ่นใหม่ผูกกับ holding โดยตรง ส่วน version legacy อาจไม่มี
 * source_holding_id จึงต้องใช้ลิงก์ SDS แยกตามงานก่อน และค่อย fallback ไปยัง
 * product ที่มี holding ในห้องเพื่อรองรับข้อมูลก่อน migration เฉพาะกรณีที่
 * product นั้นไม่มี holding ของงานปนอยู่ด้วย ถ้ามีทั้งสอง scope ต้องรอการผูก
 * source holding อย่าง explicit ก่อน จึงจะนำมาแสดงได้
 */
export function roomChemicalSdsVersionIds(
  versions: ChemicalSdsVisibilityVersionRow[],
  holdings: ChemicalHoldingSdsVisibilityRow[],
  departmentLinks: ChemicalDepartmentSdsVisibilityLinkRow[] = [],
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
    linksByVersion.set(versionId, [
      ...(linksByVersion.get(versionId) ?? []),
      String(link.holding_id),
    ])
  }

  const visible = new Set<string>()
  for (const version of versions) {
    if (version.id == null) continue
    const versionId = String(version.id)
    const sourceHoldingId = version.source_holding_id == null ? '' : String(version.source_holding_id)

    if (sourceHoldingId) {
      if (holdingById.get(sourceHoldingId)?.storage_scope === 'room') visible.add(versionId)
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
