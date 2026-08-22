# Registry-Central SDS Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the chemical registry the single operational entry point for every room and department SDS workflow, while keeping the two SDS tabs as filtered/read-only views. The whole-work publication action remains available from the registry.

**Architecture:** `chemical_sds_versions` remains the shared version table. A version is resolved to a registry holding through `source_holding_id` or the existing department link, so the registry row is the only place that creates, edits, and auto-publishes an SDS. The registry is also the only place that changes whole-work publication status. The room and department tabs display scoped results only; legacy department mutation endpoints remain as explicit read-only 410 responses.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript, Supabase repository, Node `assert` + `tsx` tests.

## Global Constraints

- Never use product-wide SDS fallback when a holding or department link can identify the source.
- Keep room SDS and department SDS out of each other's filtered view.
- Do not delete existing SDS files, versions, department records, or links.
- Existing legacy department files remain visible for migration/read-only inspection; new linking, replacement, rename, deletion, and upload actions do not originate from the SDS tabs.
- Workflow status cards and submit/review actions belong on `ทะเบียนสารเคมี` only.

### Task 1: Add tested holding-to-SDS resolution and workflow summary

**Files:**
- Modify: `lib/chemical-safety/sds-visibility.ts`
- Modify: `lib/chemical-safety/sds-visibility.test.ts`
- Create: `lib/chemical-safety/sds-workflow-summary.ts`
- Create: `lib/chemical-safety/sds-workflow-summary.test.ts`

- [x] **Step 1: Write failing tests** for department-linked legacy versions resolving to a registry holding, direct source resolution, and summary counts for draft/review/approved/rejected.
- [x] **Step 2: Run the focused tests** and verify they fail for the missing helper/module.
- [x] **Step 3: Implement the smallest pure helpers** with no database access.
- [x] **Step 4: Run the focused tests** and verify they pass.

### Task 2: Make repository and DTO resolution holding-scoped

**Files:**
- Modify: `lib/chemical-safety/types.ts`
- Modify: `lib/chemical-safety/repository.ts`
- Modify: `components/chemical-safety/RegistrySdsWorkflowModal.tsx`
- Modify: `lib/chemical-safety/sds-visibility.test.ts`

- [x] **Step 1: Add a failing regression assertion** that a department-linked version appears in the matching registry row and modal, while a product-wide version does not leak to another holding.
- [x] **Step 2: Run the focused test** and verify the current product-wide/explicit-only behavior fails the assertion.
- [x] **Step 3: Add holding-link metadata to `ChemicalSdsDTO` and resolve registry rows from direct source or department links.** Keep `hasSdsFile`, GHS, workflow status, and publication status scoped to that holding.
- [x] **Step 4: Filter the central modal by the same holding/link identity.**
- [x] **Step 5: Run the focused tests and TypeScript check.**

### Task 3: Move visible SDS workflow controls to the registry

**Files:**
- Modify: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Modify: `components/chemical-safety/SdsManagementClient.tsx`
- Modify: `scripts/chemical-safety-ui.test.ts`

- [x] **Step 1: Add failing UI contract assertions** for a central workflow summary and for the room SDS panel having no submit/review actions.
- [x] **Step 2: Run the UI contract test and verify it fails.**
- [x] **Step 3: Add the registry-only workflow summary** using all central SDS items and point users to the SDS action in the registry table.
- [x] **Step 4: Make both SDS panels view-only.** Keep the whole-work publication action in the registry, next to the department filter, and direct all SDS edits/uploads back to the registry row.
- [x] **Step 5: Run chemical-safety tests and verify the UI contract.**

### Task 4: Verify and hand off

- [x] Run `npm run test:chemical-safety`.
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run build`.
- [x] Run `git diff --check` and inspect `git status --short`.
- [x] Summarize the new single workflow location and any remaining legacy rows that require explicit linking.
