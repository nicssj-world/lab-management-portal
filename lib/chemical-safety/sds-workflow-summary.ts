import type { ChemicalWorkflowStatus } from './types'

export interface SdsWorkflowSummary {
  total: number
  draft: number
  inReview: number
  approved: number
  rejected: number
  superseded: number
}

export function summarizeSdsWorkflow(
  items: Array<{ status: ChemicalWorkflowStatus }>,
): SdsWorkflowSummary {
  const summary: SdsWorkflowSummary = {
    total: items.length,
    draft: 0,
    inReview: 0,
    approved: 0,
    rejected: 0,
    superseded: 0,
  }

  for (const item of items) {
    if (item.status === 'draft') summary.draft += 1
    if (item.status === 'in_review') summary.inReview += 1
    if (item.status === 'approved') summary.approved += 1
    if (item.status === 'rejected') summary.rejected += 1
    if (item.status === 'superseded') summary.superseded += 1
  }

  return summary
}
