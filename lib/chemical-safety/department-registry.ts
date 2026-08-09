export interface RegisteredDepartmentChemical {
  productId: string
  productName: string
  holdingId: string
  unitId: string
  lotNumber?: string | null
  packageValue?: number | null
  packageUnit?: string | null
  currentContainerCount?: number | null
  aliases?: readonly string[]
}

interface NameMatch {
  score: number
  nameLength: number
}

const DISTINCT_PRODUCT_VARIANT_TOKENS = new Set([
  'buffer',
  'calibrator',
  'calibrators',
  'control',
  'controls',
  'diluent',
  'reagent',
  'reagents',
  'solution',
  'substrate',
])

function nameTokens(value: string): string[] {
  const tokens = value
    .replace(/[™®©]/gu, '')
    .normalize('NFKC')
    .toLocaleLowerCase('en')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const withoutAnti = tokens[0] === 'anti' ? tokens.slice(1) : tokens
  while (
    withoutAnti.length > 0
    && /^(?:thai|thใหม่|eng|english|ภาษาไทย|version)$/u.test(withoutAnti.at(-1) ?? '')
  ) {
    withoutAnti.pop()
  }
  return withoutAnti
}

function compareNames(source: string, candidate: string): NameMatch | null {
  const sourceTokens = nameTokens(source)
  const candidateTokens = nameTokens(candidate)
  if (sourceTokens.length === 0 || candidateTokens.length === 0) return null

  const sourceCompact = sourceTokens.join('')
  const candidateCompact = candidateTokens.join('')
  if (sourceCompact === candidateCompact) return { score: 0, nameLength: candidateCompact.length }

  const sourceIsPrefix = sourceTokens.length < candidateTokens.length
    && sourceTokens.every((token, index) => candidateTokens[index] === token)
  if (sourceIsPrefix) return { score: 1, nameLength: candidateCompact.length }

  const candidateIsPrefix = candidateTokens.length < sourceTokens.length
    && candidateTokens.every((token, index) => sourceTokens[index] === token)
  const firstSourceSuffix = sourceTokens[candidateTokens.length]
  if (candidateIsPrefix && !DISTINCT_PRODUCT_VARIANT_TOKENS.has(firstSourceSuffix)) {
    return { score: 2, nameLength: candidateCompact.length }
  }

  return null
}

/**
 * Finds an already-held product for the same unit without treating a marker
 * embedded in another product name (for example CD4 in a Tritest name) as a
 * match. Department SDS filenames may omit a registered suffix such as
 * FITC/PE or add a method/language suffix, so a complete leading token
 * sequence is allowed in either direction.
 */
export function findRegisteredDepartmentChemicals(
  sdsNames: readonly string[],
  unitId: string | null,
  registered: readonly RegisteredDepartmentChemical[],
): RegisteredDepartmentChemical[] {
  if (!unitId) return []

  const matches = registered.flatMap(candidate => {
    if (candidate.unitId !== unitId) return []
    const names = [candidate.productName, ...(candidate.aliases ?? [])]
    const match = sdsNames
      .flatMap(source => names.map(name => compareNames(source, name)))
      .filter((value): value is NameMatch => value !== null)
      .sort((left, right) => left.score - right.score || left.nameLength - right.nameLength)[0]
    return match ? [{ candidate, match }] : []
  })

  const sorted = matches.sort((left, right) => (
    left.match.score - right.match.score
    || left.match.nameLength - right.match.nameLength
    || left.candidate.productId.localeCompare(right.candidate.productId)
    || left.candidate.holdingId.localeCompare(right.candidate.holdingId)
  ))

  return sorted
    .map(item => item.candidate)
    .filter((candidate, index, all) => (
      all.findIndex(item => item.holdingId === candidate.holdingId) === index
    ))
}

export function findRegisteredDepartmentChemical(
  sdsNames: readonly string[],
  unitId: string | null,
  registered: readonly RegisteredDepartmentChemical[],
): RegisteredDepartmentChemical | null {
  return findRegisteredDepartmentChemicals(sdsNames, unitId, registered)[0] ?? null
}
