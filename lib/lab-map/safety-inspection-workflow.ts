import type {
  SafetyAssetDTO,
  SafetyInspectionFilters,
  SafetyInspectionQueue,
} from './types'

export function buildSafetyInspectionQueue({ assets, filters, completedAssetIds }: {
  assets: readonly SafetyAssetDTO[]
  filters: SafetyInspectionFilters
  completedAssetIds: ReadonlySet<string>
}): SafetyInspectionQueue {
  const query = filters.query.trim().toLocaleLowerCase('th')
  const filtered = assets.filter(asset => (
    (!query || `${asset.code} ${asset.nameTh} ${asset.sourceNoteTh ?? ''}`.toLocaleLowerCase('th').includes(query))
    && (!filters.status || asset.operationalStatus === filters.status)
    && (!filters.kind || asset.kind === filters.kind)
    && (!filters.spaceCode || asset.spaceCode === filters.spaceCode)
  ))
  const ordered = [...filtered].sort((a, b) => (
    (a.spaceCode ?? '').localeCompare(b.spaceCode ?? '', 'th', { numeric: true })
    || a.y - b.y
    || a.x - b.x
    || a.code.localeCompare(b.code, 'th', { numeric: true })
  ))
  const items = ordered.map((asset, index) => ({
    asset,
    completed: completedAssetIds.has(asset.id),
    sequence: index + 1,
  }))
  const completed = items.filter(item => item.completed).length
  return {
    items,
    progress: { completed, total: items.length, remaining: items.length - completed },
  }
}

function adjacentSafetyAssetCode(
  queue: SafetyInspectionQueue,
  currentCode: string,
  offset: -1 | 1,
): string | null {
  if (queue.items.length === 0) return null
  const currentIndex = queue.items.findIndex(item => item.asset.code === currentCode)
  if (currentIndex === -1) return queue.items[0]?.asset.code ?? null
  const nextIndex = (currentIndex + offset + queue.items.length) % queue.items.length
  return queue.items[nextIndex]?.asset.code ?? null
}

export function nextSafetyAssetCode(queue: SafetyInspectionQueue, currentCode: string): string | null {
  return adjacentSafetyAssetCode(queue, currentCode, 1)
}

export function previousSafetyAssetCode(queue: SafetyInspectionQueue, currentCode: string): string | null {
  return adjacentSafetyAssetCode(queue, currentCode, -1)
}
