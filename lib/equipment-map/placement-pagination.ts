export const PLACEMENT_PAGE_SIZE = 5
export const UNCLASSIFIED_FILTER = '__unclassified__'

interface PlacementFilterable {
  department: string
  classification: string | null
  needsCalibration: boolean
}

export function filterPlacementItems<T extends PlacementFilterable>(
  items: readonly T[],
  department: string,
  classification: string,
  calibrationOnly = false,
): T[] {
  return items.filter((item) => {
    if (department && item.department.trim() !== department) return false
    if (classification === UNCLASSIFIED_FILTER && item.classification?.trim()) return false
    if (classification && classification !== UNCLASSIFIED_FILTER && item.classification?.trim() !== classification) return false
    if (calibrationOnly && !item.needsCalibration) return false
    return true
  })
}

export function placementFilterOptions(items: readonly PlacementFilterable[]) {
  const departments = new Set<string>()
  const classifications = new Set<string>()
  let hasUnclassified = false

  for (const item of items) {
    const department = item.department.trim()
    const classification = item.classification?.trim()
    if (department) departments.add(department)
    if (classification) classifications.add(classification)
    else hasUnclassified = true
  }

  return {
    departments: [...departments].sort((a, b) => a.localeCompare(b, 'th')),
    classifications: [...classifications].sort((a, b) => a.localeCompare(b, 'th')),
    hasUnclassified,
  }
}

export function paginatePlacementItems<T>(items: readonly T[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / PLACEMENT_PAGE_SIZE))
  const page = Math.min(pageCount, Math.max(1, Math.trunc(requestedPage) || 1))
  const start = (page - 1) * PLACEMENT_PAGE_SIZE
  const pageItems = items.slice(start, start + PLACEMENT_PAGE_SIZE)

  return {
    items: pageItems,
    page,
    pageCount,
    from: items.length === 0 ? 0 : start + 1,
    to: Math.min(start + pageItems.length, items.length),
  }
}
