import type { ChemicalSdsState, ChemicalWorkflowStatus, MeasuredUnit, QuantityUnit, SdsMatchStatus } from './types'

export interface QuantityPart {
  value: number
  unit: QuantityUnit
  count: number
}

export interface QuantityTotal {
  value: number
  unit: QuantityUnit
}

export interface QuantityConflictInput {
  calculated: QuantityTotal | null
  reportedRaw: string | null
}

export interface CurrentSdsStateInput {
  status: ChemicalWorkflowStatus | null
  reviewDueOn: string | null
  matchStatus?: SdsMatchStatus | null
}

export function normalizeChemicalName(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeCasNumber(value: string | null | undefined): string | null {
  const normalized = (value ?? '').normalize('NFKC').trim().replace(/\s*[\-–—]\s*/g, '-').replace(/\s+/g, '')
  return normalized === '' ? null : normalized
}

export function calculateHoldingTotal(parts: readonly QuantityPart[]): QuantityTotal {
  if (parts.length === 0) {
    throw new Error('At least one package part is required')
  }

  const dimensions = new Set(parts.map(part => unitDimension(part.unit)))
  if (dimensions.size > 1) {
    throw new Error('Cannot combine mass and volume quantities, or different count-based units')
  }

  const baseTotal = parts.reduce((total, part) => {
    if (!Number.isFinite(part.value) || !Number.isFinite(part.count) || part.value < 0 || part.count < 0) {
      throw new Error('Package values and counts must be finite non-negative numbers')
    }

    const packageTotal = part.value * part.count
    const baseValue = toBaseUnit(packageTotal, part.unit)
    const nextTotal = total + baseValue
    if (!Number.isFinite(packageTotal) || !Number.isFinite(baseValue) || !Number.isFinite(nextTotal)) {
      throw new Error('Calculated quantity must be finite')
    }

    return nextTotal
  }, 0)
  const dimension = dimensions.values().next().value

  // หน่วยนับจำนวน (ไม่ใช่ mL/L/g/kg) ไม่มีการแปลง/รวมหน่วย — คืนยอดรวมด้วยหน่วยเดิมตรงๆ
  if (dimension !== 'volume' && dimension !== 'mass') {
    return { value: roundToSix(baseTotal), unit: parts[0].unit }
  }

  if (baseTotal >= 1000) {
    return {
      value: roundToSix(baseTotal / 1000),
      unit: dimension === 'volume' ? 'L' : 'kg',
    }
  }

  return {
    value: roundToSix(baseTotal),
    unit: dimension === 'volume' ? 'mL' : 'g',
  }
}

/**
 * Calculate a holding total from the fields stored on an inventory row.
 *
 * Older imports may already have a calculated total (and can contain mixed
 * package sizes), so callers should use this as a fallback when that value is
 * absent. Returning null keeps malformed existing rows visible instead of
 * making the registry query fail.
 */
export function calculateHoldingTotalFromFields(input: {
  packageValue: number | null | undefined
  packageUnit: unknown
  currentContainerCount: number | null | undefined
}): QuantityTotal | null {
  if (
    input.packageValue == null
    || input.currentContainerCount == null
    || !Number.isInteger(input.currentContainerCount)
    || !isQuantityUnit(input.packageUnit)
  ) {
    return null
  }

  try {
    return calculateHoldingTotal([{
      value: input.packageValue,
      unit: input.packageUnit,
      count: input.currentContainerCount,
    }])
  } catch {
    return null
  }
}

export function isMeasuredUnit(value: unknown): value is MeasuredUnit {
  return value === 'mL' || value === 'L' || value === 'g' || value === 'kg'
}

/** หน่วยที่วัดได้ (mL/L/g/kg) หรือหน่วยนับจำนวนอิสระที่ไม่ว่างเปล่า เช่น 'test', 'kit' */
export function isQuantityUnit(value: unknown): value is QuantityUnit {
  if (isMeasuredUnit(value)) return true
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 20
}

export function detectQuantityConflict({ calculated, reportedRaw }: QuantityConflictInput): boolean {
  const raw = reportedRaw?.trim()
  if (!raw) return false

  const reported = parseReportedQuantity(raw)
  if (!reported || !calculated) return true

  const calculatedDimension = unitDimension(calculated.unit)
  if (reported.dimension !== calculatedDimension) return true

  return Math.abs(reported.baseValue - toBaseUnit(calculated.value, calculated.unit)) > 1e-6
}

export function currentSdsState(input: CurrentSdsStateInput, todayIso: string): ChemicalSdsState {
  if (input.matchStatus === 'mismatch') return 'mismatch'
  if (input.matchStatus === 'missing') return 'missing'

  if (input.status === 'approved') {
    return input.reviewDueOn !== null && input.reviewDueOn < todayIso ? 'review_due' : 'approved'
  }

  if (input.status === 'draft' || input.status === 'in_review' || input.matchStatus === 'candidate' || input.matchStatus === 'duplicate') {
    return 'draft'
  }

  return 'missing'
}

function unitDimension(unit: QuantityUnit): string {
  if (unit === 'mL' || unit === 'L') return 'volume'
  if (unit === 'g' || unit === 'kg') return 'mass'
  // หน่วยนับจำนวน: รวมกันได้เฉพาะข้อความหน่วยเดียวกันเท่านั้น
  return `count:${unit}`
}

function measuredUnitDimension(unit: MeasuredUnit): 'volume' | 'mass' {
  return unit === 'mL' || unit === 'L' ? 'volume' : 'mass'
}

function toBaseUnit(value: number, unit: QuantityUnit): number {
  return unit === 'L' || unit === 'kg' ? value * 1000 : value
}

function roundToSix(value: number): number {
  const rounded = Number(value.toFixed(6))
  return Object.is(rounded, -0) ? 0 : rounded
}

function parseReportedQuantity(value: string): { baseValue: number; dimension: 'volume' | 'mass' } | null {
  const match = value.normalize('NFKC').toLowerCase().match(
    /([-+]?(?:\d[\d.,]*|\.\d+))\s*(?<![a-z])((?:millilit(?:er|re)s?|ml|lit(?:er|re)s?|l|kilograms?|kg|grams?|g)|มิลลิลิตร|มล\.?|ลิตร|กิโลกรัม|กก\.?|กรัม)(?![a-z])/
  )
  if (!match) return null

  const parsedValue = parseQuantityNumber(match[1])
  if (parsedValue === null || parsedValue < 0) return null

  const unit = normalizedQuantityUnit(match[2])
  return unit ? { baseValue: toBaseUnit(parsedValue, unit), dimension: measuredUnitDimension(unit) } : null
}

function parseQuantityNumber(value: string): number | null {
  let canonical: string
  if (/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(value)) {
    canonical = value.replace(/,/g, '')
  } else if (/^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(value)) {
    canonical = value.replace(/\./g, '').replace(',', '.')
  } else if (/^[+-]?\d+,\d+$/.test(value)) {
    canonical = value.replace(',', '.')
  } else if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(value)) {
    canonical = value
  } else {
    return null
  }

  const parsed = Number(canonical)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizedQuantityUnit(value: string): MeasuredUnit | null {
  const normalized = value.replace(/\.$/, '')
  if (normalized === 'ml' || normalized === 'milliliter' || normalized === 'milliliters' || normalized === 'millilitre' || normalized === 'millilitres' || normalized === 'มิลลิลิตร' || normalized === 'มล') return 'mL'
  if (normalized === 'l' || normalized === 'liter' || normalized === 'liters' || normalized === 'litre' || normalized === 'litres' || normalized === 'ลิตร') return 'L'
  if (normalized === 'g' || normalized === 'gram' || normalized === 'grams' || normalized === 'กรัม') return 'g'
  if (normalized === 'kg' || normalized === 'kilogram' || normalized === 'kilograms' || normalized === 'กิโลกรัม' || normalized === 'กก') return 'kg'
  return null
}
