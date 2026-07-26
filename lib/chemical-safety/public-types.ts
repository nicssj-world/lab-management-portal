import type { GhsPictogramCode } from './types'

export interface PublicSdsResult {
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  manufacturer: string | null
  supplier: string | null
  productCode: string | null
  units: Array<{ code: string; name: string }>
  language: string
  revisionLabel: string | null
  effectiveOn: string | null
  signalWord: string | null
  pictogramCodes: GhsPictogramCode[]
  hCodes: string[]
  hazardStatements: Array<{ code: string; text: string }>
  sourceUrl: string | null
  viewUrl: string
  downloadUrl: string
}

export interface PublicSdsFile {
  r2Key: string
  fileName: string
  contentType: 'application/pdf'
}

export interface PublicSdsFilters {
  q?: string
  unit?: string
  language?: string
  ghs?: GhsPictogramCode
  productIds?: string[]
}
