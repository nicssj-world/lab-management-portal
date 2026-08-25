import type { RejectionReasonCategoryCode } from './analysis'

export type RejectionAnalysisSummary = {
  from_year: number
  to_year: number
  work: string | null
  analysis_ready: boolean
  analysis_version: string
  total_other: number
  categorized_total: number
  no_detail_total: number
  needs_review_total: number
  by_category: Array<{
    category_code: RejectionReasonCategoryCode
    category_label: string
    total: number
    percent: number
    needs_review: boolean
  }>
  by_year: Array<{ yr: number; total: number }>
  by_year_category: Array<{ yr: number; category_code: RejectionReasonCategoryCode; total: number }>
  by_work: Array<{ work: string; total: number }>
  review_queue: Array<{
    normalized_reason: string
    example_reason: string
    variants: string[]
    total: number
    confidence: number
    suggested_category_code: RejectionReasonCategoryCode
    suggested_category_label: string
    work: string
  }>
  last_analyzed_at: string | null
}

