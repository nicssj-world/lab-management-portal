import { normalizeCasNumber, normalizeChemicalName } from '../domain'
import type { SdsMatchStatus } from '../types'

export interface SdsMatchProduct {
  name: string
  aliases?: readonly string[]
  casNumber: string | null
  concentration: string | null
  manufacturer?: string | null
  supplier?: string | null
  productCode?: string | null
}

export interface SdsMatchCandidate {
  fileName: string
  extractedText: string | null
  sha256: string
}

export interface SdsCandidateScore {
  score: number
  positiveEvidence: string[]
  negativeEvidence: string[]
  exactCas: boolean
  concentrationConfirmed: boolean
  hardMismatch: boolean
}

const CAS_PATTERN = /\b\d{2,7}-\d{2}-\d\b/g
const CONCENTRATION_PATTERN = /\b\d+(?:\.\d+)?\s*%/g

export function scoreSdsCandidate(product: SdsMatchProduct, candidate: SdsMatchCandidate): SdsCandidateScore {
  const positiveEvidence: string[] = []
  const negativeEvidence: string[] = []
  const fileIdentity = normalizeIdentity(removeLastExtension(candidate.fileName))
  const textIdentity = normalizeIdentity(candidate.extractedText ?? '')
  const combinedOriginal = `${candidate.fileName}\n${candidate.extractedText ?? ''}`
  const identities = [product.name, ...(product.aliases ?? [])].filter(value => value.trim() !== '')
  let score = 0

  const filenameName = identities.find(identity => containsIdentity(fileIdentity, identity))
  if (filenameName) {
    score += 10
    positiveEvidence.push(`filename name match: ${filenameName}`)
  }
  const textName = identities.find(identity => containsIdentity(textIdentity, identity))
  if (textName) {
    score += 25
    positiveEvidence.push(`document name match: ${textName}`)
  }

  const expectedCas = normalizeCasNumber(product.casNumber)
  const candidateCas = uniqueMatches(combinedOriginal, CAS_PATTERN).map(value => normalizeCasNumber(value) ?? value)
  const exactCas = expectedCas !== null && candidateCas.includes(expectedCas)
  let hardMismatch = false
  if (exactCas) {
    score += 50
    positiveEvidence.push(`CAS confirmed: ${product.casNumber}`)
  }
  if (expectedCas !== null) {
    for (const cas of candidateCas.filter(value => value !== expectedCas)) {
      hardMismatch = true
      score -= 100
      negativeEvidence.push(`conflicting CAS: ${cas} (expected ${product.casNumber})`)
    }
  }

  const expectedConcentration = normalizeConcentration(product.concentration)
  const candidateConcentrations = uniqueMatches(combinedOriginal, CONCENTRATION_PATTERN).map(normalizeConcentration)
  const concentrationConfirmed = expectedConcentration !== null && candidateConcentrations.includes(expectedConcentration)
  if (expectedConcentration !== null) {
    if (concentrationConfirmed) {
      score += 20
      positiveEvidence.push(`concentration confirmed: ${product.concentration}`)
    } else {
      score -= 10
      negativeEvidence.push(`concentration not confirmed: ${product.concentration}`)
    }
    for (const concentration of candidateConcentrations.filter(value => value !== expectedConcentration)) {
      score -= 15
      negativeEvidence.push(`conflicting concentration: ${concentration} (expected ${product.concentration})`)
    }
  }

  const labeledIdentityFields = extractLabeledIdentityFields(candidate.extractedText ?? '')
  score += scoreExpectedIdentityField(
    'manufacturer',
    product.manufacturer,
    labeledIdentityFields.manufacturer,
    positiveEvidence,
    negativeEvidence,
  )
  score += scoreExpectedIdentityField(
    'supplier',
    product.supplier,
    labeledIdentityFields.supplier,
    positiveEvidence,
    negativeEvidence,
  )
  score += scoreProductCode(product.productCode, combinedOriginal, positiveEvidence, negativeEvidence)

  return {
    score,
    positiveEvidence,
    negativeEvidence,
    exactCas,
    concentrationConfirmed,
    hardMismatch,
  }
}

export function classifySdsCandidate(score: SdsCandidateScore): SdsMatchStatus {
  if (score.hardMismatch || score.score <= 0) return 'mismatch'
  return 'candidate'
}

function scoreExpectedIdentityField(
  label: 'manufacturer' | 'supplier',
  expected: string | null | undefined,
  recognizedValues: readonly string[],
  positiveEvidence: string[],
  negativeEvidence: string[],
): number {
  if (!expected || recognizedValues.length === 0) return 0

  let fieldScore = 0
  const matchingValues = recognizedValues.filter(value => containsIdentity(normalizeIdentity(value), expected))
  if (matchingValues.length > 0) {
    positiveEvidence.push(`${label} confirmed: ${expected}`)
    fieldScore += 15
  }
  for (const value of recognizedValues.filter(value => !containsIdentity(normalizeIdentity(value), expected))) {
    negativeEvidence.push(`${label} differs: ${value} (expected ${expected})`)
    fieldScore -= 15
  }
  return fieldScore
}

function extractLabeledIdentityFields(candidateText: string): Record<'manufacturer' | 'supplier', string[]> {
  const fields: Record<'manufacturer' | 'supplier', string[]> = { manufacturer: [], supplier: [] }
  const label = '(?:manufacturer|manufactured by|supplier|supplied by|distributor|distributed by)'
  const nextLabel = '(?:manufacturer|manufactured by|supplier|supplied by|distributor|distributed by|product(?:\\s*(?:code|number|no\\.?))?|catalog(?:ue)?\\s*(?:code|number|no\\.?)?|cas(?:\\s*(?:number|no\\.?))?|concentration)'
  const pattern = new RegExp(
    `\\b(${label})\\s*[:#-]\\s*(.*?)(?=\\r?\\n|(?:\\s*[/;|]\\s*|\\s+)${nextLabel}\\s*[:#-]|$)`,
    'gis',
  )

  for (const match of candidateText.matchAll(pattern)) {
    const normalizedLabel = match[1].toLowerCase()
    const field = normalizedLabel.startsWith('manufacturer') || normalizedLabel === 'manufactured by'
      ? 'manufacturer'
      : 'supplier'
    const value = match[2].trim().replace(/\s+/g, ' ')
    if (value !== '' && !fields[field].includes(value)) fields[field].push(value)
  }
  return fields
}

function scoreProductCode(
  expected: string | null | undefined,
  candidateText: string,
  positiveEvidence: string[],
  negativeEvidence: string[],
): number {
  if (!expected) return 0
  const normalizedExpected = normalizeProductCode(expected)
  const recognizedCodes = [...candidateText.matchAll(/\b(?:product(?:\s*(?:code|number|no\.?))?|catalog(?:ue)?\s*(?:code|number|no\.?)?)\s*[:#-]?\s*([a-z0-9][a-z0-9._/-]{2,})/gi)]
    .map(match => match[1])
  if (recognizedCodes.some(code => normalizeProductCode(code) === normalizedExpected)) {
    positiveEvidence.push(`product code confirmed: ${expected}`)
    return 20
  }
  if (recognizedCodes.length > 0) {
    negativeEvidence.push(`product code differs: ${recognizedCodes.join(', ')} (expected ${expected})`)
    return -20
  }
  return 0
}

function normalizeIdentity(value: string): string {
  return normalizeChemicalName(value)
    .replace(/[^\p{L}\p{N}%]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

function containsIdentity(normalizedHaystack: string, identity: string): boolean {
  const normalizedNeedle = normalizeIdentity(identity)
  return normalizedNeedle !== '' && ` ${normalizedHaystack} `.includes(` ${normalizedNeedle} `)
}

function normalizeConcentration(value: string | null | undefined): string | null {
  const match = value?.normalize('NFKC').match(/\d+(?:\.\d+)?\s*%/)
  if (!match) return null
  const amount = Number(match[0].replace('%', '').trim())
  return Number.isFinite(amount) ? `${amount}%` : null
}

function normalizeProductCode(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function removeLastExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

function uniqueMatches(value: string, pattern: RegExp): string[] {
  return [...new Set(value.match(pattern) ?? [])]
}
