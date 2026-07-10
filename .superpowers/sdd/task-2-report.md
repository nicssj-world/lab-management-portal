# Task 2 Report: Pending-approval documents query

## Summary
Successfully implemented the `getPendingApprovalDocuments` function and `PendingApprovalDoc` interface for the dashboard Attention Queue feature.

## What Was Implemented

### File: `lib/documents/pending.ts`
- **Added interface:** `PendingApprovalDoc` — exports document metadata needed by the Attention Queue
  - `id: string`
  - `document_code: string`
  - `title: string`
  - `updated_at: string`

- **Added function:** `getPendingApprovalDocuments(): Promise<PendingApprovalDoc[]>` — queries documents (and their active revision drafts) with Review or Approved status

### Implementation Details
The function correctly:
1. Fetches documents with status 'Review' or 'Approved' (with non-null parent documents)
2. Fetches active revision drafts and filters for those in 'Review' or 'Approved' status
3. Resolves draft parent documents via batch query using the `in()` operator (efficient with dedup)
4. **Deduplicates** by document id using a `Set<string>` to avoid double-counting documents that appear in both the status query and drafts query
5. Reuses existing `getActiveRevisionDrafts()` helper — no modification to existing exports

### Existing Exports (Unchanged)
- `getSourceUploadedDocumentIds(): Promise<string[]>` — remains untouched
- `getActiveRevisionDrafts(): Promise<ActiveDraftRow[]>` — remains untouched

## TypeScript Type-Check

**Command:** `npx tsc --noEmit`

**Result:** ✓ PASS — No output, no errors

## Git Commit

**Commit SHA:** `e0b2132`
**Commit Message:** "Add getPendingApprovalDocuments for the dashboard Attention Queue"

```
[main e0b2132] Add getPendingApprovalDocuments for the dashboard Attention Queue
 1 file changed, 52 insertions(+)
```

## Self-Review

- ✓ Only added new type + function; did not modify existing `getSourceUploadedDocumentIds` or `getActiveRevisionDrafts`
- ✓ Dedup logic correctly uses `seen` Set to track document ids from both status query and drafts query, preventing double-count
- ✓ Type-check passes with no errors
- ✓ Function signature and comment match the brief exactly
- ✓ File appended in correct location (end of file after existing exports)
- ✓ Commit message matches brief specification

## Files Changed
- `lib/documents/pending.ts` — 52 lines added (new interface + function)

## Issues or Concerns
None. Task is complete and ready for integration.
