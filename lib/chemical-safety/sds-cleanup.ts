export interface SdsCleanupVersionRow {
  id: string
  product_id: string
  source_holding_id: string | null
  status?: string | null
  file_id?: string | null
}

export interface SdsCleanupHoldingRow {
  id: string
  product_id: string
  storage_scope: string
}

export interface SdsCleanupDepartmentLinkRow {
  sds_version_id: string | null
  holding_id: string | null
}

export interface SdsCleanupProductRow {
  id: string
  canonical_name: string
}

export interface SdsCleanupAssignment {
  versionId: string
  holdingId: string
  productId: string
  productName: string
  status: string | null
  fileId: string | null
  reason: 'unique_room_holding'
}

export interface SdsCleanupAmbiguousRow {
  versionId: string
  productId: string
  productName: string
  status: string | null
  fileId: string | null
  reason: 'both_scopes' | 'multiple_room_holdings' | 'no_holding'
  holdingIds: string[]
}

export interface SdsCleanupPlan {
  assignments: SdsCleanupAssignment[]
  ambiguous: SdsCleanupAmbiguousRow[]
  resolved: { room: number; department: number }
  errors: string[]
}

export interface SdsCleanupInput {
  versions: SdsCleanupVersionRow[]
  holdings: SdsCleanupHoldingRow[]
  departmentLinks: SdsCleanupDepartmentLinkRow[]
  products: SdsCleanupProductRow[]
}

function productLabel(productId: string, productsById: Map<string, SdsCleanupProductRow>): string {
  return productsById.get(productId)?.canonical_name ?? productId
}

export function buildSdsCleanupPlan(input: SdsCleanupInput): SdsCleanupPlan {
  const holdingsById = new Map(input.holdings.map(holding => [holding.id, holding]))
  const productsById = new Map(input.products.map(product => [product.id, product]))
  const holdingsByProduct = new Map<string, SdsCleanupHoldingRow[]>()
  for (const holding of input.holdings) {
    const rows = holdingsByProduct.get(holding.product_id) ?? []
    rows.push(holding)
    holdingsByProduct.set(holding.product_id, rows)
  }
  const linksByVersion = new Map<string, SdsCleanupDepartmentLinkRow[]>()
  for (const link of input.departmentLinks) {
    if (link.sds_version_id == null) continue
    const rows = linksByVersion.get(link.sds_version_id) ?? []
    rows.push(link)
    linksByVersion.set(link.sds_version_id, rows)
  }

  const assignments: SdsCleanupAssignment[] = []
  const ambiguous: SdsCleanupAmbiguousRow[] = []
  const errors: string[] = []
  let room = 0
  let department = 0

  for (const version of input.versions) {
    const name = productLabel(version.product_id, productsById)
    const directHolding = version.source_holding_id
      ? holdingsById.get(version.source_holding_id)
      : undefined
    const links = linksByVersion.get(version.id) ?? []

    if (version.source_holding_id && !directHolding) {
      errors.push(`${version.id}: source holding ${version.source_holding_id} not found`)
      continue
    }

    if (directHolding && directHolding.product_id !== version.product_id) {
      errors.push(`${version.id}: source holding product mismatch (${directHolding.product_id} vs ${version.product_id})`)
      continue
    }

    const linkedHoldings = links.map(link => {
      if (link.holding_id == null) {
        errors.push(`${version.id}: department link has no holding`)
        return undefined
      }
      const holding = holdingsById.get(link.holding_id)
      if (!holding) {
        errors.push(`${version.id}: linked holding ${link.holding_id} not found`)
        return undefined
      }
      if (holding.product_id !== version.product_id) {
        errors.push(`${version.id}: linked holding product mismatch (${holding.product_id} vs ${version.product_id})`)
        return undefined
      }
      return holding
    }).filter((holding): holding is SdsCleanupHoldingRow => holding !== undefined)

    if (directHolding) {
      const conflictingLink = linkedHoldings.find(holding => holding.storage_scope !== directHolding.storage_scope)
      if (conflictingLink) {
        errors.push(`${version.id}: source holding scope conflicts with department link ${conflictingLink.id}`)
        continue
      }
      if (directHolding.storage_scope === 'room') room += 1
      else if (directHolding.storage_scope === 'department') department += 1
      else errors.push(`${version.id}: unsupported source holding scope ${directHolding.storage_scope}`)
      continue
    }

    if (links.length > 0) {
      if (linkedHoldings.length === links.length && linkedHoldings.every(holding => holding.storage_scope === 'department')) {
        department += 1
      } else if (linkedHoldings.length === links.length) {
        errors.push(`${version.id}: department link does not point to department holding`)
      }
      continue
    }

    const productHoldings = holdingsByProduct.get(version.product_id) ?? []
    const roomHoldings = productHoldings.filter(holding => holding.storage_scope === 'room')
    const departmentHoldings = productHoldings.filter(holding => holding.storage_scope === 'department')

    if (roomHoldings.length === 1 && departmentHoldings.length === 0) {
      assignments.push({
        versionId: version.id,
        holdingId: roomHoldings[0].id,
        productId: version.product_id,
        productName: name,
        status: version.status ?? null,
        fileId: version.file_id ?? null,
        reason: 'unique_room_holding',
      })
      room += 1
      continue
    }

    const reason = roomHoldings.length > 1
      ? 'multiple_room_holdings'
      : roomHoldings.length > 0 && departmentHoldings.length > 0
        ? 'both_scopes'
        : 'no_holding'
    ambiguous.push({
      versionId: version.id,
      productId: version.product_id,
      productName: name,
      status: version.status ?? null,
      fileId: version.file_id ?? null,
      reason,
      holdingIds: productHoldings.map(holding => holding.id),
    })
  }

  return { assignments, ambiguous, resolved: { room, department }, errors }
}
