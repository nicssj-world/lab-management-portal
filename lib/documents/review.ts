// Annual document-review cycle helpers (ISO 15189 8.3). Pure functions — safe to import
// from both server components/routes and client components.
//
// The document form only stores the last edit/review date (edit_date, mirrored into
// expiry_date) — there's no separate "due date" field. The review cycle is annual, so the
// actual due date is that date plus one year.

// Controlled-document types whose review cadence is tracked — shows the "ต้องทบทวน" badge.
export const REVIEW_TRACKED_TYPES = ['QP', 'WI', 'Manual', 'QM'] as const

// Types eligible for the one-click "ทบทวนแล้ว ไม่มีการแก้ไข" (review-only) flow. Manual and QM
// have no cover page and a different layout, so they must go through a full Rev+ — they still
// get the reminder badge (REVIEW_TRACKED_TYPES) but not the review-only action.
export const REVIEW_ONLY_TYPES = ['QP', 'WI'] as const

// How many days before the due date the "ต้องทบทวน" window opens.
export const REVIEW_DUE_SOON_DAYS = 90

export interface ReviewDateFields {
  edit_date: string | null
  expiry_date: string | null
  last_reviewed_at?: string | null
}

export function isReviewTrackedType(type: string | null | undefined): boolean {
  return REVIEW_TRACKED_TYPES.includes(type as (typeof REVIEW_TRACKED_TYPES)[number])
}

export function isReviewOnlyType(type: string | null | undefined): boolean {
  return REVIEW_ONLY_TYPES.includes(type as (typeof REVIEW_ONLY_TYPES)[number])
}

export function reviewDueDate(doc: ReviewDateFields): string | null {
  // Due = one year after the latest of: last review (with or without change), content edit,
  // or the legacy expiry_date. A review-only pass sets last_reviewed_at without touching
  // edit_date, so taking the max keeps the clock resetting correctly.
  const base = [doc.last_reviewed_at, doc.edit_date, doc.expiry_date]
    .filter((v): v is string => Boolean(v))
    .sort()
    .pop()
  if (!base) return null
  const d = new Date(base + 'T00:00:00')
  d.setFullYear(d.getFullYear() + 1)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysUntilReviewDue(doc: ReviewDateFields): number | null {
  const due = reviewDueDate(doc)
  if (!due) return null
  const target = new Date(due + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export type ReviewWindowState = 'none' | 'due-soon' | 'overdue'

// 'due-soon' = within REVIEW_DUE_SOON_DAYS of the due date; 'overdue' = past it.
// Type/status gating is the caller's job — this only looks at the dates.
export function reviewWindowState(doc: ReviewDateFields): ReviewWindowState {
  const days = daysUntilReviewDue(doc)
  if (days === null) return 'none'
  if (days < 0) return 'overdue'
  if (days < REVIEW_DUE_SOON_DAYS) return 'due-soon'
  return 'none'
}
