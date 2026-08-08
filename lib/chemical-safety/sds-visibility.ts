export interface ChemicalHoldingSdsVisibilityRow {
  product_id?: unknown
  unit_id?: unknown
  storage_scope?: unknown
}

/**
 * SDS ห้องสารเคมีต้องอ้างอิงจากสารที่มี holding ในห้องจริงเท่านั้น
 * เพราะ chemical_sds_versions เป็นข้อมูลระดับ product และจึงอาจถูกสร้างจาก SDS แยกตามงานได้ด้วย
 */
export function roomChemicalProductIds(
  holdings: ChemicalHoldingSdsVisibilityRow[],
  unitId?: string,
): Set<string> {
  return new Set(
    holdings
      .filter(row => row.product_id != null && row.unit_id != null)
      .filter(row => row.storage_scope === 'room' && (unitId == null || String(row.unit_id) === unitId))
      .map(row => String(row.product_id)),
  )
}
