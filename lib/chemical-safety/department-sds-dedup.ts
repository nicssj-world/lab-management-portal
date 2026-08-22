export type DepartmentSdsDedupSource = 'legacy' | 'registry'

export interface DepartmentSdsDedupEntry {
  id: string
  fileId: string | null
  departmentCode: string
}

export interface DepartmentSdsDedupLink {
  id: string
  departmentSdsId: string
  holdingId: string
  sdsVersionId: string | null
  linkedAt?: string | null
}

export interface DepartmentSdsDedupVersion {
  id: string
  fileId: string | null
  status: string | null
  sourceHoldingId: string | null
  updatedAt?: string | null
}

export interface DepartmentSdsDedupPublication {
  id: string
  sourceHoldingId: string
  sdsVersionId: string
  status: 'active' | 'stale'
  linkedAt?: string | null
}

export interface DepartmentSdsDedupFile {
  id: string
  r2Key: string
}

export interface DepartmentSdsDedupInput {
  entries: readonly DepartmentSdsDedupEntry[]
  links: readonly DepartmentSdsDedupLink[]
  versions: readonly DepartmentSdsDedupVersion[]
  publications: readonly DepartmentSdsDedupPublication[]
  files: readonly DepartmentSdsDedupFile[]
}

export interface DepartmentSdsDedupKeeper {
  holdingId: string
  linkId: string | null
  departmentSdsId: string | null
  sdsVersionId: string | null
  source: DepartmentSdsDedupSource
}

export interface DepartmentSdsDedupPlan {
  keepers: DepartmentSdsDedupKeeper[]
  deleteLinkIds: string[]
  deleteDepartmentSdsIds: string[]
  deleteVersionIds: string[]
  deleteFileIds: string[]
}

const VERSION_STATUS_PRIORITY: Record<string, number> = {
  approved: 4,
  in_review: 3,
  draft: 2,
  rejected: 1,
  superseded: 0,
}

function timestamp(value: string | null | undefined): number {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed
}

function compareLinks(
  left: DepartmentSdsDedupLink,
  right: DepartmentSdsDedupLink,
  versionsById: ReadonlyMap<string, DepartmentSdsDedupVersion>,
): number {
  const leftVersion = left.sdsVersionId ? versionsById.get(left.sdsVersionId) : undefined
  const rightVersion = right.sdsVersionId ? versionsById.get(right.sdsVersionId) : undefined
  const statusDifference = (VERSION_STATUS_PRIORITY[leftVersion?.status ?? ''] ?? -1)
    - (VERSION_STATUS_PRIORITY[rightVersion?.status ?? ''] ?? -1)
  if (statusDifference !== 0) return statusDifference

  const updatedDifference = timestamp(leftVersion?.updatedAt) - timestamp(rightVersion?.updatedAt)
  if (updatedDifference !== 0) return updatedDifference

  const linkedDifference = timestamp(left.linkedAt) - timestamp(right.linkedAt)
  if (linkedDifference !== 0) return linkedDifference

  // A stable tie-breaker is important for imported rows whose timestamps were
  // copied in the same batch. It makes dry-run and apply produce the same plan.
  return left.id.localeCompare(right.id)
}

function comparePublications(left: DepartmentSdsDedupPublication, right: DepartmentSdsDedupPublication): number {
  const linkedDifference = timestamp(left.linkedAt) - timestamp(right.linkedAt)
  return linkedDifference !== 0 ? linkedDifference : left.id.localeCompare(right.id)
}

/**
 * Builds the one-SDS-per-holding cleanup plan.
 *
 * An active registry publication is authoritative over legacy department links.
 * If no publication exists, the best legacy link is selected by workflow status,
 * then most-recent update/link time, with a stable id tie-breaker for imports.
 * Physical files are only planned for deletion when no remaining version or
 * department entry references them.
 */
export function buildDepartmentSdsDedupPlan(input: DepartmentSdsDedupInput): DepartmentSdsDedupPlan {
  const entriesById = new Map(input.entries.map(entry => [entry.id, entry]))
  const versionsById = new Map(input.versions.map(version => [version.id, version]))
  const linksByHolding = new Map<string, DepartmentSdsDedupLink[]>()
  for (const link of input.links) {
    const links = linksByHolding.get(link.holdingId) ?? []
    links.push(link)
    linksByHolding.set(link.holdingId, links)
  }

  const activePublicationsByHolding = new Map<string, DepartmentSdsDedupPublication[]>()
  for (const publication of input.publications) {
    if (publication.status !== 'active') continue
    const publications = activePublicationsByHolding.get(publication.sourceHoldingId) ?? []
    publications.push(publication)
    activePublicationsByHolding.set(publication.sourceHoldingId, publications)
  }

  const holdingIds = [...new Set([
    ...linksByHolding.keys(),
    ...activePublicationsByHolding.keys(),
  ])].sort()
  const keepers: DepartmentSdsDedupKeeper[] = []
  const deleteLinkIds = new Set<string>()

  for (const holdingId of holdingIds) {
    const links = linksByHolding.get(holdingId) ?? []
    const publication = [...(activePublicationsByHolding.get(holdingId) ?? [])]
      .sort(comparePublications)
      .at(-1)

    if (publication) {
      keepers.push({
        holdingId,
        linkId: null,
        departmentSdsId: null,
        sdsVersionId: publication.sdsVersionId,
        source: 'registry',
      })
      for (const link of links) deleteLinkIds.add(link.id)
      continue
    }

    if (links.length === 0) continue
    const keeper = [...links].sort((left, right) => compareLinks(left, right, versionsById)).at(-1)!
    keepers.push({
      holdingId,
      linkId: keeper.id,
      departmentSdsId: keeper.departmentSdsId,
      sdsVersionId: keeper.sdsVersionId,
      source: 'legacy',
    })
    for (const link of links) {
      if (link.id !== keeper.id) deleteLinkIds.add(link.id)
    }
  }

  const deleteDepartmentSdsIds = new Set<string>()
  for (const link of input.links) {
    if (!deleteLinkIds.has(link.id)) continue
    const stillLinked = input.links.some(other => (
      other.departmentSdsId === link.departmentSdsId && !deleteLinkIds.has(other.id)
    ))
    if (!stillLinked && entriesById.has(link.departmentSdsId)) {
      deleteDepartmentSdsIds.add(link.departmentSdsId)
    }
  }

  const deleteVersionIds = new Set<string>()
  for (const link of input.links) {
    if (!deleteLinkIds.has(link.id) || !link.sdsVersionId || !versionsById.has(link.sdsVersionId)) continue
    const stillLinked = input.links.some(other => (
      other.id !== link.id
      && !deleteLinkIds.has(other.id)
      && other.sdsVersionId === link.sdsVersionId
    ))
    const stillPublished = input.publications.some(publication => publication.sdsVersionId === link.sdsVersionId)
    const version = versionsById.get(link.sdsVersionId)
    if (!stillLinked && !stillPublished && !version?.sourceHoldingId) {
      deleteVersionIds.add(link.sdsVersionId)
    }
  }

  const remainingVersionFileIds = new Set(
    input.versions
      .filter(version => !deleteVersionIds.has(version.id) && version.fileId)
      .map(version => version.fileId!),
  )
  const remainingEntryFileIds = new Set(
    input.entries
      .filter(entry => !deleteDepartmentSdsIds.has(entry.id) && entry.fileId)
      .map(entry => entry.fileId!),
  )
  const deleteFileIds = input.files
    .filter(file => !remainingVersionFileIds.has(file.id) && !remainingEntryFileIds.has(file.id))
    .filter(file => input.versions.some(version => deleteVersionIds.has(version.id) && version.fileId === file.id)
      || input.entries.some(entry => deleteDepartmentSdsIds.has(entry.id) && entry.fileId === file.id))
    .map(file => file.id)
    .sort()

  return {
    keepers,
    deleteLinkIds: [...deleteLinkIds].sort(),
    deleteDepartmentSdsIds: [...deleteDepartmentSdsIds].sort(),
    deleteVersionIds: [...deleteVersionIds].sort(),
    deleteFileIds,
  }
}

export function canonicalDepartmentSdsLinkIds(plan: DepartmentSdsDedupPlan): Set<string> {
  return new Set(plan.keepers.flatMap(keeper => keeper.linkId ? [keeper.linkId] : []))
}
