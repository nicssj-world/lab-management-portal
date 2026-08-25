import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  applyReviewedCategory,
  categoryLabel,
  classifyRejectionReason,
  isRejectionReasonCategoryCode,
  REJECTION_ANALYSIS_VERSION,
  type RejectionClassification,
  type RejectionReasonCategoryCode,
} from './analysis'
import type { RejectionAnalysisSummary } from './analysis-types'

const PAGE_SIZE = 1000
const DEFAULT_FROM_YEAR = 2023

type AnalysisOptions = {
  fromYear?: number
  toYear?: number
  fromDate?: string
  toDate?: string
  work?: string | null
}

export type RejectionAnalysisRow = {
  id: string
  spcmdate: string
  reason: string | null
  work: string | null
  ward: string | null
  reason_normalized: string | null
  reason_category: string | null
  reason_confidence: number | null
  reason_analysis_source: string | null
  reason_analysis_rule: string | null
  reason_analyzed_at: string | null
}

type RejectionMapping = {
  normalized_reason: string
  category_code: string
}

type ClassifiedRow = RejectionAnalysisRow & {
  classification: RejectionClassification
}

function dateForYear(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function resolveDateRange(options: AnalysisOptions): { fromYear: number; toYear: number; fromDate: string; toDate: string } {
  const fromYear = options.fromYear ?? DEFAULT_FROM_YEAR
  const toYear = options.toYear ?? new Date().getFullYear()
  if (!Number.isInteger(fromYear) || !Number.isInteger(toYear) || fromYear < 2000 || toYear < fromYear || toYear > 2100) {
    throw new Error('ช่วงปีไม่ถูกต้อง')
  }

  return {
    fromYear,
    toYear,
    fromDate: options.fromDate ?? dateForYear(fromYear, 1, 1),
    toDate: options.toDate ?? dateForYear(toYear, 12, 31),
  }
}

async function fetchAnalysisRows(options: AnalysisOptions): Promise<RejectionAnalysisRow[]> {
  const range = resolveDateRange(options)
  const rows: RejectionAnalysisRow[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabaseAdmin
      .from('rejection_logs')
      .select('id,spcmdate,reason,work,ward,reason_normalized,reason_category,reason_confidence,reason_analysis_source,reason_analysis_rule,reason_analyzed_at')
      .eq('reject', 'อื่นๆ')
      .gte('spcmdate', range.fromDate)
      .lte('spcmdate', range.toDate)
      .order('spcmdate', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (options.work) query = query.eq('work', options.work)

    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as RejectionAnalysisRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
}

async function loadReasonMappings(): Promise<Map<string, RejectionReasonCategoryCode>> {
  const { data, error } = await supabaseAdmin
    .from('rejection_reason_mappings')
    .select('normalized_reason,category_code')
    .limit(10000)

  if (error) throw error
  const mappings = new Map<string, RejectionReasonCategoryCode>()
  for (const row of (data ?? []) as RejectionMapping[]) {
    if (row.normalized_reason && isRejectionReasonCategoryCode(row.category_code)) {
      mappings.set(row.normalized_reason, row.category_code)
    }
  }
  return mappings
}

function classifyRows(
  rows: RejectionAnalysisRow[],
  mappings: Map<string, RejectionReasonCategoryCode>
): ClassifiedRow[] {
  return rows.map(row => {
    const automatic = classifyRejectionReason(row.reason)
    const isExistingReview = row.reason_analysis_source === 'review'
      && row.reason_normalized === automatic.normalizedReason
      && isRejectionReasonCategoryCode(row.reason_category)

    if (isExistingReview) {
      return {
        ...row,
        classification: applyReviewedCategory(automatic, row.reason_category as RejectionReasonCategoryCode),
      }
    }

    const mappedCategory = mappings.get(automatic.normalizedReason)
    return {
      ...row,
      classification: mappedCategory
        ? applyReviewedCategory(automatic, mappedCategory, 'review')
        : automatic,
    }
  })
}

function stampedRule(classification: RejectionClassification): string {
  return `${REJECTION_ANALYSIS_VERSION}:${classification.matchedRule}`
}

function rowIsReady(row: RejectionAnalysisRow): boolean {
  return row.reason_category !== null
    && row.reason_normalized !== null
    && row.reason_analysis_source !== null
    && row.reason_analyzed_at !== null
    && row.reason_analysis_rule?.startsWith(`${REJECTION_ANALYSIS_VERSION}:`) === true
}

async function persistClassifications(rows: ClassifiedRow[]): Promise<void> {
  const now = new Date().toISOString()
  const updates: Array<Record<string, unknown>> = []

  for (const row of rows) {
    const classification = row.classification
    const fields = {
      reason_normalized: classification.normalizedReason,
      reason_category: classification.categoryCode,
      reason_confidence: classification.confidence,
      reason_analysis_source: classification.source,
      reason_analysis_rule: stampedRule(classification),
      reason_analyzed_at: now,
    }

    const unchanged = row.reason_normalized === fields.reason_normalized
      && row.reason_category === fields.reason_category
      && Number(row.reason_confidence ?? -1) === fields.reason_confidence
      && row.reason_analysis_source === fields.reason_analysis_source
      && row.reason_analysis_rule === fields.reason_analysis_rule
    if (unchanged && row.reason_analyzed_at) continue

    updates.push({ id: row.id, ...fields })
  }

  for (let i = 0; i < updates.length; i += 500) {
    const batch = updates.slice(i, i + 500)
    const { error } = await supabaseAdmin.rpc('apply_rejection_analysis', { p_rows: batch })
    if (error) throw error
  }
}

function topWork(rows: ClassifiedRow[]): string {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const work = row.work?.trim() || 'ไม่ระบุ Section'
    counts.set(work, (counts.get(work) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ไม่ระบุ Section'
}

function buildSummary(
  rows: ClassifiedRow[],
  options: AnalysisOptions,
  analysisReady: boolean
): RejectionAnalysisSummary {
  const range = resolveDateRange(options)
  const categoryCounts = new Map<RejectionReasonCategoryCode, number>()
  const yearCounts = new Map<number, number>()
  const yearCategoryCounts = new Map<string, { yr: number; categoryCode: RejectionReasonCategoryCode; total: number }>()
  const workCounts = new Map<string, number>()
  const reviewGroups = new Map<string, {
    exampleReason: string
    variants: Map<string, number>
    total: number
    confidence: number
    rows: ClassifiedRow[]
  }>()
  let lastAnalyzedAt: string | null = null

  for (const row of rows) {
    const classification = row.classification
    const year = Number(String(row.spcmdate).slice(0, 4))
    const work = row.work?.trim() || 'ไม่ระบุ Section'

    categoryCounts.set(classification.categoryCode, (categoryCounts.get(classification.categoryCode) ?? 0) + 1)
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1)
    const yearKey = `${year}:${classification.categoryCode}`
    const yearCategory = yearCategoryCounts.get(yearKey) ?? { yr: year, categoryCode: classification.categoryCode, total: 0 }
    yearCategory.total++
    yearCategoryCounts.set(yearKey, yearCategory)
    workCounts.set(work, (workCounts.get(work) ?? 0) + 1)

    if (classification.needsReview) {
      const key = classification.normalizedReason
      const group = reviewGroups.get(key) ?? {
        exampleReason: row.reason?.trim() || key,
        variants: new Map<string, number>(),
        total: 0,
        confidence: classification.confidence,
        rows: [],
      }
      const variant = row.reason?.trim() || '(ว่าง)'
      group.variants.set(variant, (group.variants.get(variant) ?? 0) + 1)
      group.total++
      group.confidence = Math.min(group.confidence, classification.confidence)
      group.rows.push(row)
      reviewGroups.set(key, group)
    }

    const analyzedAt = row.reason_analyzed_at
    if (analyzedAt && (!lastAnalyzedAt || analyzedAt > lastAnalyzedAt)) lastAnalyzedAt = analyzedAt
  }

  const total = rows.length
  const noDetail = categoryCounts.get('no_detail') ?? 0
  const needsReview = rows.filter(row => row.classification.needsReview).length
  const categoryOrder = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1])

  return {
    from_year: range.fromYear,
    to_year: range.toYear,
    work: options.work ?? null,
    analysis_ready: analysisReady,
    analysis_version: REJECTION_ANALYSIS_VERSION,
    total_other: total,
    categorized_total: Math.max(total - noDetail - needsReview, 0),
    no_detail_total: noDetail,
    needs_review_total: needsReview,
    by_category: categoryOrder.map(([categoryCode, count]) => ({
      category_code: categoryCode,
      category_label: categoryLabel(categoryCode),
      total: count,
      percent: total ? Number(((count / total) * 100).toFixed(1)) : 0,
      needs_review: categoryCode === 'other_review',
    })),
    by_year: [...yearCounts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([yr, count]) => ({ yr, total: count })),
    by_year_category: [...yearCategoryCounts.values()]
      .sort((a, b) => a.yr - b.yr || b.total - a.total)
      .map(row => ({ yr: row.yr, category_code: row.categoryCode, total: row.total })),
    by_work: [...workCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([work, count]) => ({ work, total: count })),
    review_queue: [...reviewGroups.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 50)
      .map(([normalizedReason, group]) => ({
        normalized_reason: normalizedReason,
        example_reason: group.exampleReason,
        variants: [...group.variants.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([variant]) => variant),
        total: group.total,
        confidence: group.confidence,
        suggested_category_code: 'other_review',
        suggested_category_label: categoryLabel('other_review'),
        work: topWork(group.rows),
      })),
    last_analyzed_at: lastAnalyzedAt,
  }
}

export async function getRejectionAnalysisSummary(options: AnalysisOptions = {}): Promise<RejectionAnalysisSummary> {
  const rows = await fetchAnalysisRows(options)
  const mappings = await loadReasonMappings()
  const classified = classifyRows(rows, mappings)
  return buildSummary(classified, options, rows.every(rowIsReady))
}

export async function analyzeRejectionData(options: AnalysisOptions = {}): Promise<RejectionAnalysisSummary> {
  const rows = await fetchAnalysisRows(options)
  const mappings = await loadReasonMappings()
  const classified = classifyRows(rows, mappings)
  await persistClassifications(classified)
  return buildSummary(classified, options, true)
}

export async function saveReviewedReasonMappings({
  normalizedReasons,
  categoryCode,
  actorId,
}: {
  normalizedReasons: string[]
  categoryCode: RejectionReasonCategoryCode
  actorId: string
}): Promise<{ updated: number; mapped: number }> {
  const reasons = [...new Set(
    normalizedReasons
      .map(reason => reason.trim().slice(0, 500))
      .filter(Boolean),
  )]
  if (reasons.length === 0) throw new Error('ไม่พบข้อความเหตุผลสำหรับจัดหมวดหมู่')
  if (!isRejectionReasonCategoryCode(categoryCode)) throw new Error('หมวดหมู่ไม่ถูกต้อง')

  const now = new Date().toISOString()
  const { error: mappingError } = await supabaseAdmin
    .from('rejection_reason_mappings')
    .upsert(reasons.map(normalizedReason => ({
      normalized_reason: normalizedReason,
      category_code: categoryCode,
      created_by: actorId,
      updated_by: actorId,
      updated_at: now,
    })), { onConflict: 'normalized_reason' })
  if (mappingError) throw mappingError

  const { count, error } = await supabaseAdmin
    .from('rejection_logs')
    .update({
      reason_category: categoryCode,
      reason_confidence: 1,
      reason_analysis_source: 'review',
      reason_analysis_rule: `${REJECTION_ANALYSIS_VERSION}:reviewed-mapping`,
      reason_analyzed_at: now,
      reason_reviewed_by: actorId,
      reason_reviewed_at: now,
    }, { count: 'exact' })
    .eq('reject', 'อื่นๆ')
    .in('reason_normalized', reasons)

  if (error) throw error
  return { updated: count ?? 0, mapped: reasons.length }
}

export async function saveReviewedReasonMapping({
  normalizedReason,
  categoryCode,
  actorId,
}: {
  normalizedReason: string
  categoryCode: RejectionReasonCategoryCode
  actorId: string
}): Promise<number> {
  const result = await saveReviewedReasonMappings({
    normalizedReasons: [normalizedReason],
    categoryCode,
    actorId,
  })
  return result.updated
}
