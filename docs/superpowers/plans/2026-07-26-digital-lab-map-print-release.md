# Digital Lab Map Print and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled map releases and generate separate, legible A3/A4 PDF or high-resolution PNG artifacts for evacuation, infection control, and visitor navigation.

**Architecture:** A release record binds an immutable manifest hash to version/effective-date/reviewer/approver metadata. Staff preview any draft with a visible watermark; only a published release can produce an “ฉบับใช้งานจริง” export. A print-only React sheet renders from the same typed manifest and approved route presets as the web map, then client-side export uses the installed `html2canvas`, `jsPDF`, and `qrcode` packages.

**Tech Stack:** Next.js 16.2 App Router and Route Handlers, React 19.2, Supabase/Postgres, Node `crypto`, html2canvas 1.4, jsPDF 4.2, qrcode 1.5, TH Sarabun font assets already installed, Node `assert` + `tsx` tests.

## Global Constraints

- Requires the Foundation and Staff/Personnel Plans plus `lab_map_versions` from `scripts/lab-map-module.sql`.
- Evacuation exports use only approved presets; never calculate a shortest path.
- The permanently locked electrical-control-room door may be shown as locked but must never appear in a route.
- Export three separate map kinds: `evacuation`, `infection_control`, and `visitor_navigation`. Do not combine layers.
- Public visitor exports use only the public projection and may not reveal BSL2/PCR topology, private doors, infection classification, or personnel.
- A draft or metadata-incomplete version exports only with a prominent “ร่าง — ห้ามใช้ติดตั้ง” watermark.
- The website is supplementary; approved physical signs remain usable during power/network outages.
- No equipment layer, equipment status legend, or equipment data appears in any export.

---

### Task 1: Define release hashing and publication rules

**Files:**
- Create: `lib/lab-map/release.ts`
- Create: `lib/lab-map/release.test.ts`
- Modify: `lib/lab-map/types.ts`
- Modify: `scripts/lab-map-module.sql`
- Modify: `scripts/lab-map-schema.test.ts`

**Interfaces:**
- Produces: `MapReleaseStatus`, `MapReleaseDTO`, `computeManifestHash(input)`, `validatePublishableRelease(input)`, and `isOfficialRelease(input)`.

- [ ] **Step 1: Write failing release tests**

Test stable SHA-256 output independent of object key order, hash changes when geometry/routes/classification change, and publication rejects missing effective date, reviewer, approver, approval timestamp, station evacuation preset, or a route containing the locked door.

```ts
import assert from 'node:assert/strict'
import { computeManifestHash, validatePublishableRelease } from './release'

assert.equal(computeManifestHash({ b: 2, a: 1 }), computeManifestHash({ a: 1, b: 2 }))
assert.notEqual(computeManifestHash({ route: ['a'] }), computeManifestHash({ route: ['b'] }))
assert.ok(validatePublishableRelease({ status: 'draft' }).length > 0)
```

- [ ] **Step 2: Confirm failure**

Run: `npx tsx lib/lab-map/release.test.ts`

Expected: FAIL because `release.ts` does not exist.

- [ ] **Step 3: Complete version schema**

Ensure `lab_map_versions` has unique `version_code`, `status` constrained to `draft|published|retired`, `manifest_hash`, `effective_date`, `reviewed_by`, `approved_by`, `approved_at`, `notes`, timestamps, and a partial unique index allowing only one `published` record. Reviewer and approver reference `profiles`; require distinct people at publication in application validation.

- [ ] **Step 4: Implement canonical hashing and validation**

Canonicalize objects by recursively sorting keys while preserving array order, serialize once, and hash with SHA-256. Hash the private manifest version, spaces, zones, access points, stations, routes, classifications, and public projection. `validatePublishableRelease` returns all human-readable blockers and calls the existing manifest validator.

- [ ] **Step 5: Pass tests and commit**

Run:

```bash
npx tsx lib/lab-map/release.test.ts
npx tsx scripts/lab-map-schema.test.ts
```

Expected: PASS.

```bash
git add lib/lab-map/types.ts lib/lab-map/release.ts lib/lab-map/release.test.ts scripts/lab-map-module.sql scripts/lab-map-schema.test.ts
git commit -m "feat(lab-map): define controlled map releases"
```

---

### Task 2: Add audited draft and publish APIs

**Files:**
- Create: `app/api/admin/lab-map/releases/route.ts`
- Create: `app/api/admin/lab-map/releases/[id]/route.ts`
- Create: `app/api/admin/lab-map/releases/[id]/publish/route.ts`
- Create: `scripts/lab-map-release-api.test.ts`
- Modify: `app/(protected)/staff/activity/ActivityClient.tsx`

**Interfaces:**
- `GET /api/admin/lab-map/releases`: authenticated release history.
- `POST /api/admin/lab-map/releases`: Admin/Manager creates a draft bound to the current hash.
- `PATCH /api/admin/lab-map/releases/[id]`: Admin/Manager edits draft metadata only.
- `POST /api/admin/lab-map/releases/[id]/publish`: Admin/Manager publishes after full validation.

- [ ] **Step 1: Write failing API contract tests**

Assert authentication on every route, normalized role gates for Admin/Manager, Zod validation, audit actions, immutable published records, current-hash comparison, distinct reviewer/approver, and transaction-safe retirement/publication behavior. A stale draft whose hash differs from the current manifest must return `409` and remain draft.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/lab-map-release-api.test.ts`

Expected: FAIL because release Route Handlers do not exist.

- [ ] **Step 3: Implement list/create/update**

Follow existing admin Route Handler and `audit_log` conventions. `POST` computes the hash server-side; never trust a client-provided hash. `PATCH` accepts only reviewer, approver, effective date, and notes while status is draft.

- [ ] **Step 4: Implement fail-closed publish**

Recompute the hash, run domain/release validation, then publish through a Postgres RPC added to `scripts/lab-map-module.sql` that locks the release rows, retires the prior published version, and publishes the target atomically. Return the complete blocker list on `422` without changing state.

- [ ] **Step 5: Add audit labels, test, and commit**

Run:

```bash
npx tsx scripts/lab-map-release-api.test.ts
npm run test:security
```

Expected: PASS.

```bash
git add -- "app/api/admin/lab-map/releases/route.ts" ':(literal)app/api/admin/lab-map/releases/[id]/route.ts' ':(literal)app/api/admin/lab-map/releases/[id]/publish/route.ts' "app/(protected)/staff/activity/ActivityClient.tsx" scripts/lab-map-release-api.test.ts scripts/lab-map-module.sql
git commit -m "feat(lab-map): add audited release publishing"
```

---

### Task 3: Build deterministic print sheets

**Files:**
- Create: `components/lab-map/LabMapPrintSheet.tsx`
- Create: `components/lab-map/LabMapPrintStyles.tsx`
- Create: `lib/lab-map/print.ts`
- Create: `lib/lab-map/print.test.ts`
- Modify: `components/lab-map/LabMapCanvas.tsx`

**Interfaces:**
- Produces: `MapPrintKind`, `MapPaperSize`, `MapPrintDTO`, `buildMapPrintDTO(input)`, and print sheet DOM marked with `data-map-print-sheet`.

- [ ] **Step 1: Write failing print DTO tests**

For each kind assert exact layer inclusion:

- `evacuation`: selected station, “ท่านอยู่ที่นี่”, main/alternate approved routes, exits, locked-door symbol, pale base geometry; no personnel or infection fills.
- `infection_control`: red/green/yellow semantic classes with pattern IDs and PPE; no route overlay or personnel.
- `visitor_navigation`: public projection, office/station, destination group, checkpoint, visitor route; no private topology or personnel.

Also assert metadata fields: Thai title, version, effective date, printed-at, installation point, reviewer, approver, and web URL for QR.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/lab-map/print.test.ts`

Expected: FAIL because `print.ts` does not exist.

- [ ] **Step 3: Implement the DTO builder**

Accept a published/draft release plus kind, paper size, station, and optional visitor destination. Resolve only presets already present in the manifest. Missing evacuation preset returns a typed error; it never substitutes another station or computes a path.

- [ ] **Step 4: Implement the print sheet**

Use a fixed aspect canvas inside CSS `@page` sizes: A3 landscape `420mm 297mm`, A4 landscape `297mm 210mm`. Place title and metadata outside the map viewport so they never cover routes. Use Thai text plus shapes/patterns in legends, minimum print-equivalent text sizes, a north/orientation marker if approved, and QR generated from the canonical public URL. Render draft watermark diagonally above all layers.

- [ ] **Step 5: Make the existing SVG renderer print-safe**

Expose presentation props for interactive versus print mode; print mode disables focus targets, pan transforms, hover styling, and mobile panels but keeps identical geometry and semantic layer selection. Do not fork a second set of coordinates.

- [ ] **Step 6: Pass tests and commit**

Run:

```bash
npx tsx lib/lab-map/print.test.ts
npx tsx scripts/lab-map-domain.test.ts
```

Expected: PASS.

```bash
git add components/lab-map/LabMapPrintSheet.tsx components/lab-map/LabMapPrintStyles.tsx components/lab-map/LabMapCanvas.tsx lib/lab-map/print.ts lib/lab-map/print.test.ts
git commit -m "feat(lab-map): render controlled print sheets"
```

---

### Task 4: Add A3/A4 PDF and PNG export UI

**Files:**
- Create: `app/(protected)/staff/lab-map/print/page.tsx`
- Create: `components/lab-map/LabMapExportClient.tsx`
- Create: `lib/lab-map/export-client.ts`
- Create: `scripts/lab-map-export-ui.test.ts`
- Modify: `app/(protected)/staff/lab-map/page.tsx`

**Interfaces:**
- Produces: protected export screen and `exportMapAsPdf(element, options)` / `exportMapAsPng(element, options)`.

- [ ] **Step 1: Write failing export contracts**

Assert the page requires an authenticated staff session, accepts only known kind/paper/station values, disables official export without a published release, includes preview watermark for drafts, and creates filenames such as `lab-map-evacuation-office-F3-2026.07.26-01-A3.pdf`.

- [ ] **Step 2: Confirm failure**

Run: `npx tsx scripts/lab-map-export-ui.test.ts`

Expected: FAIL because the export UI does not exist.

- [ ] **Step 3: Implement client export helpers**

Load `html2canvas` and `jsPDF` only in the Client Component. Before capture, await `document.fonts.ready` and QR/image completion. Capture at sufficient scale for the selected paper, preserve SVG patterns, create landscape PDF with matching physical dimensions, and generate PNG through a temporary download link. Surface a Thai error without navigating away if capture fails.

- [ ] **Step 4: Implement the protected export page**

Use a Server Component to load the release and print DTO. The Client Component controls kind, station/destination, paper size, preview, PDF, and PNG. Changing kind resets fields that do not apply. Add a link from `/staff/lab-map`; keep the page protected through the existing `/staff` rule and add a session-guard regression assertion.

- [ ] **Step 5: Verify output**

Run:

```bash
npx tsx scripts/lab-map-export-ui.test.ts
npx tsx scripts/session-guard.test.ts
npm run build
```

Expected: PASS. Manually open one A3 PDF, one A4 PDF, and one PNG for each kind. Confirm Thai fonts, patterns, QR, margins, version metadata, and route visibility at 100% zoom.

- [ ] **Step 6: Commit export UI**

```bash
git add -- "app/(protected)/staff/lab-map/print/page.tsx" "app/(protected)/staff/lab-map/page.tsx" components/lab-map/LabMapExportClient.tsx lib/lab-map/export-client.ts scripts/lab-map-export-ui.test.ts scripts/session-guard.test.ts
git commit -m "feat(lab-map): export approved A3 and A4 maps"
```

---

### Task 5: Add physical acceptance and release runbook

**Files:**
- Create: `docs/lab-map/floor-3-acceptance.md`
- Create: `docs/lab-map/release-runbook.md`
- Modify: `README.md`

- [ ] **Step 1: Create the walk-through checklist**

Use checkboxes and sign-off fields for:

- Office to every fingerprint checkpoint, including correct Central Lab left/right mapping.
- Every station's main and alternate evacuation preset against physical signs.
- Exits 3A/3B/3C and all access-point positions.
- Locked electrical-control door excluded from all routes.
- PPE position, cold-material/reagent room, and the three-space storage zone.
- BSL2/PCR ownership under microbiology without exposing public topology.
- Infection/clean/risk classification with the responsible infection-control reviewer.
- A3/A4 legibility at actual installation distance.
- QR opening the current web version and visitor self-checkout on a real device.

Include fields for version code, installation point, reviewer, approver, effective date, signatures, corrections, and retest result.

- [ ] **Step 2: Write the release runbook**

Document migration order, preview, manifest hash comparison, physical walkthrough, publish API action, artifact generation, physical sign replacement, old-version retirement, rollback to the previous Git revision/release, and audit verification. State that a power/network outage falls back to installed approved signs.

- [ ] **Step 3: Run the full Phase 1 gate**

Run each command separately:

```bash
npm run test:lab-map
npm run test:lab-map-schema
npx tsx lib/lab-map/server.test.ts
npx tsx scripts/lab-map-personnel-api.test.ts
npx tsx scripts/lab-map-staff-ui.test.ts
npx tsx lib/lab-map/release.test.ts
npx tsx scripts/lab-map-release-api.test.ts
npx tsx lib/lab-map/print.test.ts
npx tsx scripts/lab-map-export-ui.test.ts
npm run test:security
npm run build
```

Expected: all automated gates pass before physical sign-off. Publication remains blocked until the checklist is signed.

- [ ] **Step 4: Commit runbooks**

```bash
git add docs/lab-map/floor-3-acceptance.md docs/lab-map/release-runbook.md README.md
git commit -m "docs(lab-map): add physical acceptance runbook"
```
