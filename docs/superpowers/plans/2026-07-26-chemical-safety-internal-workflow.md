# Chemical Safety Internal Workflow and Safety Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the quarantined chemical-room import into a protected Safety Hub where staff can view approved records and appointed custodians/reviewers can reconcile products, quantities, GHS data, and SDS versions through an auditable two-person workflow.

**Architecture:** Server Components load safe DTOs through one repository layer; focused Client Components own filters, dialogs, and uploads. Every mutation uses a Zod-validated Route Handler plus a server-side role-scope guard, while SQL transition functions enforce state and self-approval rules transactionally.

**Tech Stack:** Next.js 16.2.6 App Router and Route Handlers, React 19.2.4, TypeScript 5, Supabase service-role repository, private Cloudflare R2, Zod 3.25, existing sidebar/topbar primitives, Node `assert` + `tsx` tests.

## Global Constraints

- Requires `docs/superpowers/plans/2026-07-26-chemical-safety-foundation-import.md` and its applied schema/import batches.
- Source design: `docs/superpowers/specs/2026-07-26-chemical-room-sds-design.md`.
- Read installed Next.js guidance under `node_modules/next/dist/docs/01-app/` before changing routes, Route Handlers, or Server/Client component boundaries.
- All `/staff/...` routes remain protected; the repository's existing `^/(staff|kpi|lab-workload|tat)` guard already covers the new staff pages.
- Chemical Custodian is distinct from Safety Editor. Do not reuse `lab_map_safety_editors`.
- All authenticated staff may view approved internal registry/SDS information.
- Custodians edit only appointed unit scopes. Reviewers approve only appointed unit scopes. Admin appoints scopes and retires records.
- A submitter cannot approve their own request or SDS version, including when the submitter is Admin.
- Quantity editing changes the current snapshot through a reviewed change request; do not add receive/issue/transfer transactions.
- GHS structured fields are copied from the exact SDS Section 2 after physical-label verification; the import's free text remains raw evidence.
- Do not expose public `/sds`, public document exceptions, or QR resolution in this phase.

---

### Task 1: Add scoped access guards, validation, and the shared registry repository

**Files:**
- Create: `lib/chemical-safety/access.ts`
- Create: `lib/chemical-safety/schemas.ts`
- Create: `lib/chemical-safety/repository.ts`
- Create: `lib/chemical-safety/access.test.ts`
- Create: `lib/chemical-safety/repository.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `requireChemicalViewer`, `requireChemicalCustodian(unitId)`, `requireChemicalReviewer(unitId)`, and `requireChemicalAdmin`.
- Produces: `listChemicalRegistry(filters)`, `getChemicalSafetyDashboard()`, `getChemicalStorageLayout(roomCode)`, `listChemicalImportReview(filters)`, and `listInternalSds(filters)`.
- Produces Zod schemas for registry filters, product/holding proposals, SDS metadata/GHS, role scopes, submit, and review decisions.

- [ ] **Step 1: Write failing pure access tests**

Keep the decision function pure and inject loaded scopes:

```ts
import assert from 'node:assert/strict'
import { chemicalAccessDecision } from './access'

const actor = { id: 'actor-1', role: 'Medical Technologist', doc_role: null }
const scopes = [{ unitId: 'unit-a', role: 'custodian' as const }]

assert.equal(chemicalAccessDecision(actor, scopes, { action: 'view' }), true)
assert.equal(chemicalAccessDecision(actor, scopes, { action: 'edit', unitId: 'unit-a' }), true)
assert.equal(chemicalAccessDecision(actor, scopes, { action: 'edit', unitId: 'unit-b' }), false)
assert.equal(chemicalAccessDecision(actor, scopes, { action: 'review', unitId: 'unit-a' }), false)
assert.equal(chemicalAccessDecision({ ...actor, role: 'Admin' }, [], { action: 'manage_roles' }), true)
assert.equal(chemicalAccessDecision({ ...actor, role: 'Manager' }, [], { action: 'manage_roles' }), false)
```

Also test that explicit reviewer scope is required for approval and that no decision helper contains a self-approval bypass.

- [ ] **Step 2: Verify access tests fail**

Run: `npx tsx lib/chemical-safety/access.test.ts`

Expected: FAIL because `access.ts` does not exist.

- [ ] **Step 3: Implement guards using existing actor and error helpers**

`access.ts` imports `getActor`, `jsonUnauthorized`, `jsonForbidden`, `Actor`, `normalizeRole`, and `supabaseAdmin`. It is `server-only`. Load `chemical_role_scopes` for the actor once per guard and use:

```ts
export type ChemicalScope = { unitId: string; role: 'custodian' | 'reviewer' }
export type ChemicalAction =
  | { action: 'view' }
  | { action: 'edit' | 'review'; unitId: string }
  | { action: 'manage_roles' | 'retire' }

export function chemicalAccessDecision(
  actor: Pick<Actor, 'id' | 'role'>,
  scopes: ChemicalScope[],
  request: ChemicalAction,
): boolean
```

Any authenticated actor can view. Only Admin can manage roles/retire. Edit/review require the matching explicit unit scope; Admin does not implicitly approve. Return the repository's standard 401/403 JSON responses from guard failures.

- [ ] **Step 4: Write failing repository projection tests**

Define an injectable `ChemicalRepositorySource` whose methods return fixture rows. Assert `listChemicalRegistryWithSource(source, filters)`:

- joins aliases, units, holdings, locations, and only approved/current SDS;
- reports imported/calculated quantity conflicts;
- returns one row per product-unit-holding;
- filters by q/unit/room/position/SDS/GHS/lifecycle;
- never returns R2 keys, source filesystem paths, reviewer notes, or raw audit details.

Assert dashboard counts are computed from repository rows rather than constants.

- [ ] **Step 5: Implement repository boundaries and safe DTO mapping**

Export these exact signatures:

```ts
export async function listChemicalRegistry(filters: ChemicalRegistryFilters): Promise<ChemicalRegistryRow[]>
export async function getChemicalSafetyDashboard(): Promise<{
  products: number
  positions: number
  plausibleCandidates: number
  mismatches: number
  missing: number
  quantityConflicts: number
  pendingReview: number
}>
export async function getChemicalStorageLayout(roomCode: string): Promise<ChemicalStorageLocationDTO[]>
export async function listChemicalImportReview(filters: ImportReviewFilters): Promise<ChemicalImportRowDTO[]>
export async function listInternalSds(filters: InternalSdsFilters): Promise<ChemicalSdsDTO[]>
```

Map database snake_case into serializable camelCase DTOs in one place. Select SDS status/history for internal staff but never return an R2 key; use `/api/admin/chemical-safety/sds/<id>/file` as the internal file URL.

- [ ] **Step 6: Add complete Zod schemas**

Use coercion only for URL query parameters, never mutation JSON. Enforce UUIDs, non-negative numeric fields, known units, `GHS01..GHS09`, H/P code formats (`/^H\d{3}[A-Z]?$/`, `/^P\d{3}[+P\d]*$/` after normalization), allowed workflow decisions, ISO date-only strings, max text lengths, and at least one hazard class/category when submitting an SDS with structured GHS data.

The review schema is:

```ts
export const chemicalReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(1000).default(''),
}).superRefine((value, ctx) => {
  if (value.decision === 'rejected' && !value.reason) {
    ctx.addIssue({ code: 'custom', path: ['reason'], message: 'กรุณาระบุเหตุผลที่ไม่อนุมัติ' })
  }
})
```

- [ ] **Step 7: Run and register focused tests**

Append access/repository tests to `test:chemical-safety` and run:

```bash
npm run test:chemical-safety
```

Expected: schema, domain, import, access, and repository tests pass.

- [ ] **Step 8: Commit the internal server foundation**

```bash
git add lib/chemical-safety package.json
git commit -m "feat(chemical-safety): add scoped registry repository"
```

---

### Task 2: Add role-scope and product/holding review APIs

**Files:**
- Create: `app/api/admin/chemical-safety/dashboard/route.ts`
- Create: `app/api/admin/chemical-safety/registry/route.ts`
- Create: `app/api/admin/chemical-safety/storage-layout/route.ts`
- Create: `app/api/admin/chemical-safety/import-review/route.ts`
- Create: `app/api/admin/chemical-safety/role-scopes/route.ts`
- Create: `app/api/admin/chemical-safety/change-requests/route.ts`
- Create: `app/api/admin/chemical-safety/change-requests/[id]/submit/route.ts`
- Create: `app/api/admin/chemical-safety/change-requests/[id]/review/route.ts`
- Create: `scripts/chemical-safety-api.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces authenticated GET endpoints for dashboard/registry/layout/import review.
- Produces Admin-only role-scope PATCH and custodian draft/submit/reviewer decision endpoints.
- Consumes Task 1 guards, schemas, repository, and SQL RPCs.

- [ ] **Step 1: Write the failing API contract test**

Read each source file and require:

- viewer guard on every GET;
- query parsing through the exported Zod schemas;
- Admin guard on role-scope PATCH;
- custodian guard for the request's `unitId` before draft insert/patch;
- reviewer guard before RPC review;
- `await ctx.params` in dynamic Next.js 16 handlers;
- optimistic `updatedAt` checks with HTTP 409 for draft edits;
- 422 for invalid input, 404 for missing target, and fail-closed 500 for unexpected database errors;
- no direct approved-state update outside the SQL RPC.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-api.test.ts`

Expected: FAIL because the new Route Handlers do not exist.

- [ ] **Step 3: Implement read-only Route Handlers**

Each GET calls `requireChemicalViewer`, parses `req.nextUrl.searchParams`, calls the repository, and returns `{ items }` or `{ data }`. Route Handler GETs stay dynamic/default-uncached because they access request data and Supabase; do not add `force-static` or `use cache`.

- [ ] **Step 4: Implement role-scope management**

`GET /role-scopes` returns current scopes plus `profiles(id,name,role,dept)` display data to authenticated viewers. `PATCH` accepts:

```ts
{ userId: string; unitId: string; role: 'custodian'|'reviewer'; enabled: boolean }
```

Admin verifies both profile and unit exist, upserts/deletes the composite scope, and writes `chemical_safety.role_scope.grant|revoke` to `audit_log`. A person may hold both roles for a unit, but database/API self-approval protection still applies to their own submissions.

- [ ] **Step 5: Implement draft creation and optimistic editing**

`POST /change-requests` validates either a complete product snapshot or complete holding snapshot, requires custodian scope for `unitId`, and inserts status `draft`. `PATCH` on the collection is not used; add a `PATCH` export in `change-requests/[id]/submit/route.ts` only if the request remains draft, actor owns/has custodian scope, and `updatedAt` matches. Return 409 on stale state.

`POST .../[id]/submit` loads the request/unit, checks custodian scope, validates the stored complete proposal again, and calls `submit_chemical_change_request`.

- [ ] **Step 6: Implement separate reviewer decision**

`POST .../[id]/review` awaits params, loads `unit_id` and `submitted_by`, rejects the same actor before RPC with 403/422, requires reviewer scope, validates the decision, and calls `review_chemical_change_request`. Map database transition errors to 409 rather than hiding them as 500.

- [ ] **Step 7: Run API and complete focused tests**

Add the API test to the package script, then run:

```bash
npm run test:chemical-safety
npx tsc --noEmit
```

Expected: tests pass and TypeScript exits 0.

- [ ] **Step 8: Commit registry workflow APIs**

```bash
git add app/api/admin/chemical-safety scripts/chemical-safety-api.test.ts package.json
git commit -m "feat(chemical-safety): add reviewed registry workflow"
```

---

### Task 3: Add private SDS upload, GHS editing, and approval APIs

**Files:**
- Create: `lib/chemical-safety/sds-files.ts`
- Create: `lib/chemical-safety/sds-files.test.ts`
- Create: `app/api/admin/chemical-safety/sds/route.ts`
- Create: `app/api/admin/chemical-safety/sds/presign/route.ts`
- Create: `app/api/admin/chemical-safety/sds/finalize/route.ts`
- Create: `app/api/admin/chemical-safety/sds/[id]/route.ts`
- Create: `app/api/admin/chemical-safety/sds/[id]/file/route.ts`
- Create: `app/api/admin/chemical-safety/sds/[id]/submit/route.ts`
- Create: `app/api/admin/chemical-safety/sds/[id]/review/route.ts`
- Create: `scripts/chemical-safety-sds-api.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `presignChemicalPdf`, `inspectUploadedChemicalPdf`, `loadChemicalPdf`, and `deleteChemicalPdf`.
- Produces draft/list/edit/submit/review/file endpoints with unit-scoped authorization.

- [ ] **Step 1: Write failing PDF-file helper tests**

Test `.pdf`/MIME/1–50 MB checks, `%PDF-` signature, filename sanitization, SHA-256 dedupe behavior through an injected R2 adapter, and deletion of a newly uploaded duplicate after reusing the existing blob row.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/sds-files.test.ts`

Expected: FAIL because `sds-files.ts` does not exist.

- [ ] **Step 3: Implement private R2 helpers**

Use the existing `r2`, `R2_BUCKET`, `PutObjectCommand`, `HeadObjectCommand`, `GetObjectCommand`, `DeleteObjectCommand`, `getSignedUrl`, and `r2ObjectResponse`. Presign only `application/pdf` under `chemical-safety/uploads/<uuid>-<safe-name>` for 300 seconds.

Finalize performs HEAD validation, reads bytes 0–4 for `%PDF-`, streams/reads the full object to calculate SHA-256, and returns `{ key, contentType, sizeBytes, sha256 }`. If an identical `chemical_sds_files.sha256` exists, delete the temporary object and reuse the existing file row.

- [ ] **Step 4: Implement SDS draft/list/edit endpoints**

`GET /sds` is viewer-only and returns the internal repository projection. `POST /finalize` accepts product/unit plus complete file metadata, requires custodian scope, verifies the upload, inserts/reuses `chemical_sds_files`, and creates a `draft` version. `PATCH /sds/[id]` permits only draft metadata/GHS edits, validates complete structured fields, uses `updatedAt` optimistic concurrency, and calls `update_chemical_sds_draft` so metadata and hazard child rows change in one audited database transaction. Map `stale_sds_draft` to HTTP 409.

- [ ] **Step 5: Implement file streaming and transition endpoints**

The internal file route requires an authenticated viewer, loads the version/file row, supports `Range`, and returns `r2ObjectResponse` with inline/download disposition and `Cache-Control: private, no-store`. It never returns the R2 key.

Submit requires custodian scope and an exact product identity checklist: product, PDF, manufacturer/supplier where present, concentration requirement, revision/effective date, language, signal word, pictograms, and hazards. Review requires reviewer scope and a different actor, then calls the SQL RPC.

- [ ] **Step 6: Write and run API contract tests**

Require guards, MIME/magic validation, SHA-256, dedupe, private streaming, Range support, draft-only edit, self-approval rejection, and SQL RPC transitions. Ensure no route assigns `approved` directly.

Run:

```bash
npx tsx scripts/chemical-safety-sds-api.test.ts
npm run test:chemical-safety
```

Expected: all tests pass.

- [ ] **Step 7: Commit SDS workflow APIs**

```bash
git add lib/chemical-safety/sds-files.ts lib/chemical-safety/sds-files.test.ts app/api/admin/chemical-safety/sds scripts/chemical-safety-sds-api.test.ts package.json
git commit -m "feat(chemical-safety): add private SDS approval workflow"
```

---

### Task 4: Build the approved internal Safety Hub

**Files:**
- Create: `app/(protected)/staff/lab-map/chemicals/page.tsx`
- Create: `components/chemical-safety/ChemicalSafetyHubClient.tsx`
- Create: `components/chemical-safety/ChemicalOverview.tsx`
- Create: `components/chemical-safety/ChemicalStorageLayout.tsx`
- Create: `components/chemical-safety/ChemicalRegistryTable.tsx`
- Create: `components/chemical-safety/ChemicalImportReview.tsx`
- Create: `components/chemical-safety/ChemicalChangeRequestDialog.tsx`
- Create: `components/chemical-safety/ChemicalSafetyStyles.tsx`
- Create: `scripts/chemical-safety-hub-ui.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes Task 1 repository DTOs and permission flags.
- Produces the four approved tabs: ภาพรวม, ผังการจัดเก็บ, ทะเบียนสารเคมี, ตรวจสอบการนำเข้า.

- [ ] **Step 1: Write the failing UI contract test**

Require a Server Component page that calls `requireChemicalViewer`, loads dashboard/layout/registry/import rows in parallel, and passes serializable props to a narrow Client Component. Require four accessible tabs, real metric labels, all 13 positions, separated position/GHS colors, search/filter controls, conflict states, visible provenance, 44 px targets, `:focus-visible`, reduced motion, and a mobile breakpoint.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-hub-ui.test.ts`

Expected: FAIL because the Safety Hub files do not exist.

- [ ] **Step 3: Implement the Server Component boundary**

Export `dynamic = 'force-dynamic'`. Call `requireChemicalViewer()` and redirect only when its response is unauthorized; use existing protected-page conventions. Load initial data and actor scopes on the server. Pass only DTOs and booleans such as `canEditUnitIds`, `canReviewUnitIds`, and `canManageRoles`; do not pass Supabase clients, R2 keys, or local paths.

- [ ] **Step 4: Implement the overview and storage layout**

Overview cards derive from server counts and link/select the matching tab/filter. The layout renders database-driven A/B/C/T groups in the approved color identity, shows product names and explicit review warnings, and uses approved GHS pictograms as separate white/red diamond icons with text alternatives. Selecting a position opens the registry filtered to that position.

- [ ] **Step 5: Implement registry filters and edit dialog**

Registry filters cover product/alias/CAS, unit, room, position, lifecycle, SDS status, and GHS. Display reported and calculated totals together when conflicted. Custodian edit creates/updates a draft change request through the APIs; it never mutates an approved row client-side. Reviewer controls are shown only for eligible in-review items and always request a decision reason on rejection.

- [ ] **Step 6: Implement import review**

Show source batch/hash/name, raw values, normalized proposals, match evidence, conflict codes, source revision labels, and state. The UI labels the five quantity conflicts, seven mismatches, and five missing SDS items from data. It never offers an “approve all filenames” action. Unsupported DOC/DOCX/HTML rows explain that a verified PDF is required for approval.

- [ ] **Step 7: Run responsive/static checks and commit**

Append the UI test to `test:chemical-safety`, then run:

```bash
npm run test:chemical-safety
npx tsc --noEmit
```

Expected: all checks pass.

```bash
git add -- "app/(protected)/staff/lab-map/chemicals" components/chemical-safety scripts/chemical-safety-hub-ui.test.ts package.json
git commit -m "feat(chemical-safety): add chemical room Safety Hub"
```

---

### Task 5: Build internal SDS management and wire Safety navigation

**Files:**
- Create: `app/(protected)/staff/lab-map/sds/page.tsx`
- Create: `components/chemical-safety/SdsManagementClient.tsx`
- Create: `components/chemical-safety/SdsUploadDialog.tsx`
- Create: `components/chemical-safety/SdsReviewDialog.tsx`
- Create: `components/chemical-safety/ChemicalRoleScopesDialog.tsx`
- Create: `scripts/chemical-safety-navigation.test.ts`
- Modify: `components/layout/StaffSidebar.tsx`
- Modify: `components/layout/StaffTopbar.tsx`
- Modify: `scripts/lab-map-navigation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces protected `/staff/lab-map/sds` with all-unit/status search, private file view, draft upload/edit, submit/review, and Admin role-scope management.
- Extends the existing Safety sidebar group without moving `/staff/lab-map`.

- [ ] **Step 1: Write the failing navigation/SDS UI test**

Assert:

- Safety sidebar children are `/staff/lab-map`, `/staff/lab-map/chemicals`, and `/staff/lab-map/sds`;
- the parent has no resource gate and remains named ความปลอดภัย;
- best-match logic marks the longest child route active;
- Topbar has Thai/English titles for both new pages;
- `isProtectedPath` is true for both staff URLs;
- the SDS page uses the viewer guard and the client has all-unit/status filters, upload, Section 1/2 checklist, GHS inputs, review controls, and no public link.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-navigation.test.ts`

Expected: FAIL on missing routes/navigation.

- [ ] **Step 3: Implement the internal SDS page and management client**

The Server Component loads internal SDS results, units, products, scopes, and permission flags. The Client Component filters by unit, product/CAS, status, language, manufacturer, effective/review date, and GHS pictogram. File actions use the protected streaming endpoint.

Upload uses presign → direct R2 PUT → finalize. The dialog shows upload progress and does not claim success until finalize returns a draft version. GHS editing separates hazard class/category, pictograms, signal word, H/P code-and-text pairs copied from the exact SDS, storage/incompatibilities, and emergency summary.

- [ ] **Step 4: Implement review and role-scope dialogs**

Reviewer sees source filename/hash, Section 1 identity evidence, Section 2 GHS fields, exact product/concentration/manufacturer, previous approved version, and decision reason. Disable approval for the submitter in the UI while relying on server/database enforcement. Admin can grant/revoke unit-specific custodian/reviewer scopes and sees automatic explanatory text that Safety Editor is unrelated.

- [ ] **Step 5: Update sidebar/topbar without changing Proxy**

Add these children to the existing group:

```ts
{ href: '/staff/lab-map/chemicals', th: 'ห้องสารเคมี', en: 'Chemical Room', icon: 'flask', color: '#0E7490' },
{ href: '/staff/lab-map/sds', th: 'จัดการ SDS', en: 'SDS Management', icon: 'doc', color: '#0E7490' },
```

Do not add `/sds` here. Do not modify `proxy.ts` or broaden `PROTECTED_PATH_PATTERN`; regression tests prove `/staff/...` is already protected.

- [ ] **Step 6: Run navigation, security, and build checks**

Run each command separately:

```bash
npx tsx scripts/chemical-safety-navigation.test.ts
npx tsx scripts/lab-map-navigation.test.ts
npm run test:chemical-safety
npm run build
```

Expected: tests pass; build lists both new staff routes as dynamic/protected pages.

- [ ] **Step 7: Commit internal SDS and navigation**

```bash
git add -- "app/(protected)/staff/lab-map/sds" components/chemical-safety components/layout/StaffSidebar.tsx components/layout/StaffTopbar.tsx scripts/chemical-safety-navigation.test.ts scripts/lab-map-navigation.test.ts package.json
git commit -m "feat(chemical-safety): add internal SDS management"
```

---

### Task 6: Internal workflow regression and acceptance gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes Tasks 1–5 and the foundation import.
- Produces a reviewed internal registry ready for the separate public-SDS plan.

- [ ] **Step 1: Exercise a complete two-person workflow in non-production**

Appoint one custodian and a different reviewer for the initial unit. As custodian, resolve one quantity conflict, match/upload one exact SDS, enter Section 1/2/GHS data, and submit. Confirm the custodian receives 403/transition failure when attempting approval. As reviewer, approve and confirm the old approved version becomes superseded when a later revision is approved.

- [ ] **Step 2: Verify the supplied import review counts and physical-validation blockers**

Confirm the UI displays 25 products, 13 positions, five quantity conflicts, seven mismatches, five missing SDS items, and the B3/B4 normalized mapping while preserving raw `B3, B4`. Do not approve items that have not been checked against the physical bottle/SDS.

- [ ] **Step 3: Run the full internal gate**

```bash
npm run test:chemical-safety
npm run test:lab-map
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Document internal operations and commit**

Document appointing roles, resolving import rows, quantity snapshot semantics, SDS/GHS review, superseding revisions, and recovery from failed uploads.

```bash
git add README.md
git commit -m "docs(chemical-safety): document internal review workflow"
```
