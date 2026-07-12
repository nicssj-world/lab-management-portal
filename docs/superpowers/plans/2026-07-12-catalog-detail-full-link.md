# Catalog detail full-page action implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the catalog modal's full-page action beside the test title so the top header is less crowded without changing navigation or close behavior.

**Architecture:** Keep `CatalogDetailModal` as the single owner of the modal header. Split the header into a metadata/title content area and a title row; render the existing full-page `Link` in that title row and leave the close button in the header action area. Use the existing CSS class and accessibility label, adding only responsive layout rules.

**Tech Stack:** Next.js 16, React 19, TypeScript, colocated CSS-in-JSX.

## Global Constraints

- Change only `components/tests/CatalogDetailModal.tsx` and its focused structural test.
- Preserve `buildTestDetailHref(activeTest)`, the accessible label, and the close button behavior.
- Keep every interactive target at least 44px high and prevent horizontal overflow at mobile widths.
- Do not stage or modify unrelated worktree changes.

---

### Task 1: Add a failing structural regression test

**Files:**
- Create: `components/tests/CatalogDetailModal.test.ts`

**Interfaces:**
- Consumes: the source structure of `components/tests/CatalogDetailModal.tsx`.
- Produces: a regression check that the full-page link is rendered inside the title-row region and the close button remains in the header actions.

- [ ] **Step 1: Write the failing test**

Use Node `assert` and `readFileSync` to assert that the component source contains `catalog-detail-modal-title-row`, places the full-page link after the title row marker, and still contains `catalog-detail-modal-close`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx components/tests/CatalogDetailModal.test.ts`

Expected: FAIL because the current component has no title-row class.

### Task 2: Relocate the full-page link and tune responsive styles

**Files:**
- Modify: `components/tests/CatalogDetailModal.tsx`
- Test: `components/tests/CatalogDetailModal.test.ts`

**Interfaces:**
- Consumes: existing `activeTest`, `buildTestDetailHref`, and modal CSS classes.
- Produces: unchanged modal behavior with the full-page link beside the title and the close button in the top-right action area.

- [ ] **Step 1: Implement the minimal markup/CSS change**

Add `.catalog-detail-modal-title-row` as a flex row with a flexible title block and the existing full-page link. Render the link in this row, remove it from `.catalog-detail-modal-actions`, and keep only the close button there. On mobile, allow the title row to wrap and keep the link at a 44px minimum height.

- [ ] **Step 2: Run the focused test**

Run: `npx tsx components/tests/CatalogDetailModal.test.ts`

Expected: PASS.

- [ ] **Step 3: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: PASS with no new type errors.

- [ ] **Step 4: Review the diff**

Run: `git diff -- components/tests/CatalogDetailModal.tsx components/tests/CatalogDetailModal.test.ts` and verify the link destination and aria-label are unchanged.

- [ ] **Step 5: Commit**

```powershell
git add -- components/tests/CatalogDetailModal.tsx components/tests/CatalogDetailModal.test.ts docs/superpowers/plans/2026-07-12-catalog-detail-full-link.md
git commit -m "feat: relocate catalog full-page action"
```
