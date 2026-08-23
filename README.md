# Lab Management Portal

Internal laboratory management portal for Chonburi Hospital. The app includes the staff portal, quality document control, test catalog, equipment, workload, TAT, risk/rejection, contracts, user/role management, and personnel modules.

## TAT Local Analysis Workflow

TAT source files are stored locally under `E:\TAT\<fiscal-year>`, for example `E:\TAT\2569`. Use the matching fiscal-year folder as new years are added.

Use local analysis as the source of truth for TAT dashboards. The local script publishes `analysis_summary_cache` only; raw `tat_records` and `phlebotomy_records` in Supabase are temporary staging data and can be removed after the cache is verified.

Example:

```powershell
npm run tat:local -- --tat "E:\TAT\2569\TAT 0169.txt" --phleb "E:\TAT\2569\Phe 0169.txt" --year 2026 --month 1
npm run tat:clean-raw -- --year 2026 --month 1 --dry-run
npm run tat:clean-raw -- --year 2026 --month 1 --yes
```

Fiscal year 2569 example mapping:

| File suffix | Month |
| --- | --- |
| `1068` | 2025-10 |
| `1168` | 2025-11 |
| `1268` | 2025-12 |
| `0169` | 2026-01 |
| `0269` | 2026-02 |
| `0369` | 2026-03 |
| `0469` | 2026-04 |
| `0569` | 2026-05 |

### Workload test-name map maintenance

`tat:local` also matches every TAT test name against `data/workload-test-map-2569.xlsx` (`buildWorkloadSummary` in `scripts/tat-local-analyze.mjs`) to decide which งาน/section a test's workload counts against. A test name with no match in the map is **silently dropped from the Workload dashboard** — no warning, no error. After importing a new month, if Workload counts look low for a section, check for unmatched names (compare `test_name` values from the TAT export column `compute_0014` against the map).

Most "new test" hits turn out to be one of these, not an actual missing test:

- **Comma-split artifact** — `splitTatRows` splits `test_name` on `,`. A map entry like `HAV Ab., IgG (serum)` or `Anti B2 Glycoprotein 1, IgG (Quantitative)` gets sent through as two fragments (`HAV Ab.` + `IgG (serum)`) that match nothing. Not a new test — leave the map entry as-is.
- **Name/spelling mismatch** — e.g. brand name from the LIS export (`Lanoxin`, `Theo-Dur (Aminophylline)`) vs. generic name in the map (`Digoxin`, `Theophylline`), or a typo in the map (`Allopurinal` vs `Allopurinol`). Fix by renaming the map's `Test (LN)` cell to match the TAT export text exactly (normalization only strips `()[]{}/_,;:|+-` and collapses whitespace — it does not fix spelling or word-order differences).
- **Panel/result component** — CBC differential counts, urine/stool microscopy findings, blood-gas sub-results, malaria morphology stages, etc. are already intentionally excluded in `workloadRule()` (`eGFR (CKD-Epi)`, `FiO2*`, `TIBC` return `[]`) or simply have no map entry because they were never meant to be counted as a separate workload test.

If a name really is new, add a row for it in the matching sheet of `data/workload-test-map-2569.xlsx` (Test name in column B; E-phis/รหัสกรม/Price can stay blank like many existing rows). **`POCT2` has no sheet in the workbook** — its rows are hardcoded in the `rows.push(...)` block at the end of `readWorkloadTestMap()`; add POCT2 tests there instead.

If the test needs a specific section regardless of which lab_section/ward it arrived under (e.g. a test that's clinically routed to `ตรวจพิเศษและปฏิบัติการตรวจต่อ` but gets exported under a `ศสม.` ward), add an explicit case to `workloadRule()` rather than relying on `findWorkloadMatch`'s exact/fuzzy matching — see the `IGRA (Interferon Gamma releasing assay) สคร6 ชลบุรี` rule for the pattern.

## Quality Task List

Run `scripts/quality-task-module.sql` in Supabase Dashboard → SQL Editor before opening `/staff/quality-tasks`. The script creates the task registry, recurring schedules, per-period work records, assignees, R2 attachment metadata, permission defaults, and the 44 ISO/QMS activities from `Quality_Task_List_CBH.xlsx`. Runtime reminders are calculated in the portal; v1 does not require cron, email, or LINE configuration.

Meeting evidence is PDF-only (maximum 20 MB) and is uploaded directly to the existing Cloudflare R2 bucket. Managers administer templates and assignments through the `งานคุณภาพ:edit` permission; assigned staff with `งานคุณภาพ:view` can schedule, attach evidence, and complete their work.

## Quality Document Workflow V2

Run the schema script before using the workflow in a real environment:

```sql
-- Supabase Dashboard -> SQL Editor
scripts/quality-document-workflow-v2.sql
```

### Core Rules

- `file_url` means the current official file.
- Word/Excel source uploads must never auto-promote into `file_url`.
- `Published` documents must not be edited directly for file/status/revision/date changes.
- Published content changes must create a working revision draft.
- Admin and Document Controller can correct small Published metadata. For QP/WI, cover-impacting metadata changes regenerate the final PDF and create an audit log.
- Signature uploads accept PNG/JPG/WebP up to 2 MB and are normalized to transparent PNG 900x260 before storage/stamping.

### QP/WI Flow

- QP and WI use the full workflow with system cover page and signature stamp.
- Reviewer creates Draft and can upload Word/Excel source only.
- Normal Draft workflow can be used for Rev.00 or Rev.>0 when the document should start from DOCX/XLSX and pass Draft -> Review -> Approved -> Published.
- Edit/Review date is the date the source draft is uploaded.
- DCC/Admin reviews the draft, uploads the content PDF without cover, then moves Draft -> Review.
- QP/WI Draft -> Review requires both the Word/Excel source file and the content PDF.
- For QP/WI Rev.>0 in normal Draft workflow, the later PDF upload must be the content PDF without the old cover; the system will generate the new cover at Published.
- Manager/Admin can move Review -> Approved; this sets approval date and approver.
- Only Quality Manager, Laboratory Director, and Admin can move Approved -> Published; this sets effective/published date, generates the cover page, merges cover + content PDF, and stores the generated final PDF as `file_url`.

### Legacy Import Flow Rev.>0

- Use this for existing controlled documents imported from Google Drive or an old system.
- Admin and Document Controller can choose "import current" when creating a document.
- The imported current revision is created as `Published` immediately and must include the current official file.
- QP/WI imports must use the existing official PDF that already has the old cover page.
- Imported QP/WI records set `legacy_cover_included = true`; the system does not regenerate or merge a new cover for that imported current file.
- Add old revision rows afterward as retroactive history/backfill.
- The next content change must use the working revision workflow; the next Published revision will use the new system cover.
- When a legacy-covered document is revised later, the old covered PDF is archived with the previous revision, imported-current markers are cleared from the current document, and the newly Published revision becomes a system-generated cover + content PDF.

### Form/Record/Reference/Card File Flow

- Non-cover document types still use status/revision/history.
- They do not generate a cover page and do not stamp signatures into files.
- Their official file can be PDF/DOC/DOCX/XLS/XLSX according to document type needs.

### Working Revisions

- Published documents are updated through "Create Revision" only.
- The system creates one active working revision draft per current document.
- When the draft is Published, the previous current version is archived into `document_revisions`, then the draft is promoted to the current document.
- Admin/Quality Manager/Laboratory Director can publish a QP/WI revision draft with "PDF already has a complete cover" checked. In that case the uploaded PDF becomes the official file directly, system cover generation is skipped, `legacy_cover_included` is set, and an audit log is written.
- Legacy revision rollback and direct workflow-history edits are intentionally blocked.

### Retroactive Revision History

- Old documents migrated from other systems can have retroactive history entries.
- Only Admin and Document Controller can add retroactive history.
- Retroactive entries use `document_revisions.history_source = 'backfill'`.
- Backfilled entries do not change the current document, `file_url`, status, or revision.
- Backfilled entries can be edited/deleted by Admin/Document Controller; workflow-generated revision history remains immutable.

### DCC Tools (ISO 15189 8.3)

Run `scripts/add-document-annual-review.sql` in Supabase before using these.

- **Obsolete watermark** — marking a document `Obsolete` stamps an "OBSOLETE / ยกเลิกใช้งาน" watermark onto every page of its official PDF so a printed/downloaded copy can't be mistaken for the in-force version. The pre-stamp file is kept for recovery; Office files are skipped.
- **Annual review reminder + one-click review** — QP/WI/Manual Published documents show a "ต้องทบทวน" badge as their yearly review approaches (and "เกินกำหนดทบทวน" when overdue). A Reviewer/DCC/Admin marks a QP/WI as "ทบทวนแล้ว"; confirmed documents queue under "รอทบทวนประจำปี" where a DCC records them in one click. This **does not bump the revision or change any content/dates** — it appends a "ทบทวนแล้ว ไม่มีการแก้ไข" (Rev "-") row to the document's revision-history page and resets the review clock. Manual (QM/MN) documents are reminded but must be reviewed through a normal Rev+.
- **Read-compliance report** (`/staff/documents/read-report`, Admin/DCC/Quality Manager/Laboratory Director) — shows how many staff have read each Published QP/WI/Manual document (X/Y), with per-document read audiences (whole division or specific departments, settable in the upload form or in bulk). Read counts are measured against the current revision's publish date, so a real content revision resets them while a no-change review does not.

## Navigation Architecture

Navigation follows one hierarchy across the portal:

- **Sidebar** — top-level modules or large groups of work. Existing sidebar groups and permission filtering remain the source of module access.
- **Module sub-navigation** — real destinations within a module. Use `ModuleSubnav` with nested routes, semantic `<nav>`, Next.js links, and `aria-current="page"`.
- **View navigation** — different presentations of the same data. Use `ViewTabs`; the selected view is stored in `?view=` or `?section=` while unrelated query parameters are preserved.
- **Filter chips** — temporary local filters. Use `FilterChips` buttons with `aria-pressed`; filters are not tabs.
- **Local state** — reserved for non-shareable UI such as form/import modes with unsaved data.

Route-backed module destinations:

| Module | Routes |
| --- | --- |
| EQA | `/staff/eqa`, `/programs`, `/rounds`, `/coverage`, `/capa`, `/settings` under `/staff/eqa` |
| OUTLAB | `/staff/outlab`, `/laboratories`, `/services`, `/certificates`, `/settings` under `/staff/outlab` |
| Risk | `/staff/risk`, `/ior`, `/register`, `/smart-rm` under `/staff/risk` |
| Satisfaction | `/staff/satisfaction`, `/surveys`, `/campaigns`, `/comments` under `/staff/satisfaction` |

EQA and OUTLAB settings routes are Admin-only. The legacy OUTLAB URL `/staff/outlab?tab=certificates&filter=...` redirects to `/staff/outlab/certificates?filter=...`.

Query-backed views:

| Screen | Query contract |
| --- | --- |
| KPI | `?view=dashboard\|annual\|compare\|satisfaction` |
| TAT | `?view=overview\|phlebotomy\|lab` |
| Rejection | `?view=<current-report-view-id>` |
| Staff Detail | `?section=profile\|training\|plan\|competency\|cert\|auth\|jd\|health\|orient` |
| Lab Workload | `?section=<overview-or-department-id>` |

Shared definitions live in `lib/navigation.ts`; shared controls live in `components/ui/ModuleSubnav.tsx`, `ViewTabs.tsx`, and `FilterChips.tsx`. Navigation controls keep a minimum 44 px target, a visible 3 px focus ring, reduced-motion support, and contained horizontal scrolling on narrow screens. The protected layout provides a skip link and route-aware breadcrumbs for deeper pages.

## Changelog

### 2026-07-19

**Navigation and accessibility**
- Added shared route-backed module navigation for EQA, OUTLAB, Risk, and Satisfaction, including Admin-only EQA/OUTLAB settings destinations.
- Added URL-backed views for KPI, TAT, Rejection, Staff Detail, and Lab Workload so bookmarks, refresh, and browser Back/Forward restore the selected view.
- Standardized local filters with pressed-state filter chips and added responsive scrolling, skip navigation, breadcrumbs, route-aware topbar titles, icon labels, focus visibility, and reduced-motion handling.
- Added focused navigation regression tests in `scripts/navigation-*.test.ts`.

### 2026-07-12

**Risk Register date fix**
- Fixed Buddhist-Era/Christian-Era date parsing in the Risk Register import pipeline (`lib/risk-utils.ts`) — 4-digit BE years, 2-digit years, and day/month order were all previously mishandled; unified into one parser shared by slash- and dash-formatted dates.
- Added future-date validation on import; the risk register UI blocks picking a future event date.
- One-time data cleanup: nulled `event_date`/`recorded_date` on 22 existing rows that had been imported with future dates by the old parser; `scripts/fix-risk-be-dates.sql` added for the separate BE/century-shift corruption pattern found in historical data.

**Document types**
- Added `QM` (Quality Manual) and `Lb` (Log book); removed the unused `Record` type. `QM` was split out of `Manual` (`QM-`prefixed document codes used to be filed as `Manual`) — the one existing Quality Manual document (`QM-LAB-01`) was migrated.
- Consolidated the "ชื่อเต็ม (Code)" type labels that used to be duplicated (inconsistently) across ~6 files into one shared source, `lib/documents/type-labels.ts`.
- Set a fixed display order everywhere types are listed: QM, QP, WI, Reference, Form, Card file, Lb, Manual, Policy, Others.
- `QM` now participates in the annual-review workflow and the read-compliance report, same as QP/WI/Manual.
- Master List PDF export: type column now shows the full label instead of the bare code; fixed the footer form code (`FM-QP-LAB-01/01`).

**Document workflow**
- New "Upd+" quick-update button for non-controlled document types (Reference, Form, Card file, Lb, Policy, Others) — one dialog to swap the file and bump the revision, instead of the full Rev+ revision-draft flow. Admin/DCC publish immediately; Reviewer queues for DCC/Admin approval (one-click "Published" shortcut added to the pending page).
- Server now enforces that only Admin/DCC can publish a revision draft (previously any edit-capable role could).
- Document code duplicate check now runs immediately (on data extract / on blur) instead of only on Save, and the Save button disables while a duplicate is still showing.
- "ดาวน์โหลดทั้งหมด" (download-all) buttons restricted to Reviewer/DCC/Admin; other roles use the per-file download buttons.
- Categories page (`/staff/documents/categories`) gained an in-page filter that narrows the existing browse tree (department → type → docs) and auto-expands matches — distinct from the document library's full-text search.
- "หมวดหมู่การตรวจ" moved from the general sidebar section into "ระบบ" (System).

**Document uploads — Vercel 4.5MB body-limit fix**
- Vercel Functions have a hard, non-configurable 4.5 MB request-body limit — this was silently breaking the official document file (and the revision-history backfill file) on any upload/revision over ~4.5 MB, despite app-level validation claiming up to 50 MB was fine. The auto-extract ("ดึงข้อมูล") preview had the same problem against its own 20 MB cap.
- Fixed by extending the presign-then-direct-R2-PUT pattern already used for Word/Excel source files to the official file too: the browser now uploads straight to Cloudflare R2 via a presigned URL (new `presign-file` route, plus a dedicated one for revision-history backfill), and only the resulting R2 key is sent to the API route — never the raw bytes.
- The extract/auto-read route now also accepts an R2 key (fetched server-side) instead of requiring raw multipart bytes, and reuses the same upload the "ดึงข้อมูล" preview already made instead of uploading the file twice.
- No workflow/state-machine behavior changed — `file_url` semantics, the Published-immutability guards, and the working-revision-draft requirement are all unaffected; only how the file bytes reach R2 changed.

**Maintenance**
- Added `scripts/archive-audit-log.sql` (see Maintenance section below) since `audit_log` has no automatic cleanup.

## Maintenance

- **Audit log archive** — `audit_log` (backs `/staff/activity`) has no automatic cleanup or cron; it just grows. Periodically (e.g. once a year) run `scripts/archive-audit-log.sql` in Supabase Dashboard > SQL Editor to move rows older than 1 year into `audit_log_archive` (cold storage, not deleted — audit_log is the QMS audit trail and should stay recoverable). Safe to re-run; no-ops on rows already archived. There's no reminder system for this — it has to be done manually when someone remembers.
- **Activity log labels** — the raw `audit_log.action` code (e.g. `outlab.certificate.create`) is translated to a Thai display name in **four separate places**, and all four drift independently, so a new module or a new audit action needs an entry in each:
  1. `app/(protected)/staff/activity/ActivityClient.tsx` — `ACTION_LABELS` (Thai text), `dotColor()` (row indicator color by action prefix), and `CATEGORIES` (the filter pills).
  2. `app/api/admin/activity/route.ts` — `CATEGORY_ACTIONS`, the server-side allowlist a pill's filter actually queries against. A pill added to (1) without a matching entry here either shows nothing or — worse — silently falls through to showing *everything* unfiltered (this exact bug shipped for the `satisfaction` pill).
  3. `app/(protected)/staff/dashboard/page.tsx` — its own, independent copy of `ACTION_LABELS` + `actionDotColor()` for the dashboard's "recent activity" widget. Not shared with (1); has drifted out of sync with it before.
  4. `lib/queries/admin.ts` — `CRUD_ACTIONS`, an allowlist that gates which actions the dashboard widget's query even fetches. An action missing here never reaches (3) at all, regardless of how complete the label maps are.

  Skipping any one of these doesn't error — it just silently degrades (raw action code shown, or the row/pill missing entirely), which is why it's easy to miss during a module's own PR. Grep all four files for an existing action prefix (e.g. `it_access.`) to find every place a new one needs adding.
  `npx tsx scripts/activity-log-labels.test.ts` statically scans every `app/**` and `lib/**` file plus SQL audit-log inserts under `supabase/**` and `scripts/**` for action codes (literals, ternaries, known audit-helper wrappers such as `auditRisk`/`auditIt`/`auditExternalQuality`/`auditChild`/`auditSatisfactionChange`, and PostgreSQL function inserts). It fails with the exact missing action + file if any of the four places above is out of sync — run it after adding a new audit action, and it should also be added to CI once one exists.
- **Controlled web manual** — apply `scripts/manual-web-source-of-truth.sql` manually in Supabase Dashboard > SQL Editor before managing document-control metadata, content owners, or revision history on `/manual`. The script preserves existing manual content, imports the official MN-LAB-01 history for Rev. 00-12 from `Fm-QP-LAB-01/03`, registers the currently published web content as Rev. 13, adds per-section snapshots, and is safe to re-run.

## Satisfaction survey module

The module is available to staff at `/staff/satisfaction`; respondents use the public `/s/[token]` route from a campaign QR code. Apply `scripts/satisfaction-survey-module.sql` manually in Supabase SQL Editor before using it. The script creates the normalized survey tables, RLS/grants, transactional RPCs, Realtime event publication, permission defaults, and Published Version 1 of forms `FM-QP-LAB-09-01` through `FM-QP-LAB-09-04`. It does not create an open campaign.

Operational rules:

- Permission resource: `แบบสำรวจความพึงพอใจ`. `view` can view/filter dashboards and comments; `edit` can build forms and manage campaigns. Only normalized roles Admin/Manager can change comment read state or export comment content.
- Published form versions are immutable. Clone a published version to a new draft, edit/preview it, then publish. Each campaign remains bound to its selected version.
- There is no permanent delete button. Discarding a draft deletes only that draft and returns to the immediately preceding published version; discarding the first, never-published draft archives the survey. On an existing deployment, apply `scripts/satisfaction-draft-discard.sql` once after the base module script.
- Public submissions go only through `/api/satisfaction/[token]`. Public clients must never read or write raw Supabase survey tables. Submission + answers + device marker + Realtime event commit in one transaction.
- Responses are anonymous: do not add user ID, name, HN, permanent IP, or User-Agent. Optional one-per-device control stores only a campaign-bound HMAC of a random HttpOnly cookie.
- Realtime subscribes only to `survey_response_events`; clients refetch aggregate data after an event. Never publish `survey_answers` to Realtime.
- General annual reports omit comment content. Comment export is a separate Admin/Manager operation. Original comment text is never edited or deleted by the module.
- KPI publication requires both survey edit and KPI edit permissions, a closed campaign, and a free `(metric_code, fiscal_year)`. Existing `kpi_satisfaction` rows are never overwritten; `survey_kpi_publications` records the immutable source/formula/counts.
- Cloudflare R2 is not used by this module unless file-upload questions are deliberately added in a future migration.

Focused verification commands are listed in `docs/superpowers/plans/2026-07-17-satisfaction-survey-builder.md`. Database-backed acceptance remains gated on manually applying the SQL above; application builds do not apply it automatically.

## Digital laboratory map

Before deploying the visitor same-link checkout flow, apply the visitor migrations to Supabase in this order:

1. `scripts/it-visitor-log.sql`
2. `scripts/it-visitor-self-checkout.sql`

The second migration adds the one-time hashed checkout credential and records whether the visitor or a staff member closed the visit. Application builds do not apply either migration automatically.

Staff/personnel rollout order:

1. Deploy the map foundation and verify the repository manifest tests.
2. Apply `scripts/lab-map-module.sql` in Supabase.
3. Compare the seeded space, zone, access-point, and station codes with `lib/lab-map/manifest.ts`.
4. Deploy the staff/personnel UI, then assign each person an optional primary or responsible area.

Personnel assignments describe work responsibility only; they are not live location or attendance tracking. The map module does not alter, relate to, or display the equipment registry. Geometry changes remain code-reviewed in Git—there is no drag-and-drop floor-plan editor.

The production origin is **`https://lab-management-cbh.vercel.app`**. Set `NEXT_PUBLIC_SITE_URL` to this same origin for deployments that generate controlled-map QR codes; the in-code fallback uses it as well. Each printed QR links to `/lab-map/[stationCode]` on this origin, while `/staff/lab-map` remains the protected internal view. `lib/lab-map/public-safety.ts` derives the QR projection from the approved manifest but sends only the exterior boundary, current installation point, evacuation routes, exits, and assembly points—never room topology, labels, internal doors, infection classes, personnel, or safety-equipment positions.

Reference drawings:

- `C:\Users\User\OneDrive\Pictures\Screenshots 1\Screenshot 2026-07-26 015253.png` — current geometry, PPE zone, cold material/reagent storage, and the electrical-control-room door.
- `C:\Users\User\OneDrive\Pictures\Screenshots 1\Screenshot 2026-07-26 020049.png` — infection-control classifications.
- `Screenshot 2026-07-26 012951.png` and `Screenshot 2026-07-26 012957.png` — approved-route source drawings for two “ท่านอยู่ที่นี่” positions.

Run the focused foundation checks with:

```bash
npm run test:lab-map
npm run test:lab-map-ui
npm run test:lab-map-public
npm run test:lab-map-navigation
npx tsx scripts/session-guard.test.ts
```

The `door-electrical-control` access point is permanently locked and must never be added to a visitor, staff-orientation, or evacuation route. Public visitor routes must end at a fingerprint checkpoint. Do not add equipment-registry data to the map.

Repository validation does not replace a physical walkthrough. Before publishing or installing any printed map, verify geometry, checkpoints, exits 3A/3B/3C, and every evacuation preset on site with the responsible safety staff and record the reviewer, approver, effective date, and map version.

Controlled A3/A4 PDF and PNG previews are available at `/staff/lab-map/print`. Drafts always carry a “ร่าง — ห้ามใช้ติดตั้ง” watermark; official export is enabled only for a published release whose manifest hash and approval metadata still validate. Use [the floor-3 acceptance checklist](docs/lab-map/floor-3-acceptance.md) and [release runbook](docs/lab-map/release-runbook.md) before replacing any physical sign. Approved installed signs remain the operational fallback during power or network outages.

### Mobile safety-equipment inspection

After the base safety-map schema, apply `supabase/migrations/20260728230000_safety_inspection_rounds_checklists.sql` through the Supabase SQL Editor. Application builds do not apply this migration automatically.

The protected safety-equipment registry supports a one-handed field workflow:

- Apply status, equipment-type, room, and search filters before starting a round. The round snapshots those filters and orders equipment by room, map Y/X coordinates, and code. A round can close only after no pending equipment remains.
- Mobile navigation is separated into **List**, **Map**, and **Inspect**. Filters, selected equipment, progress, map viewport, inspection draft, and list scroll position are retained while switching views.
- Inspect displays a checklist specific to the equipment type, `ตรวจแล้ว X/Y · เหลือ Z`, evidence controls, and a sticky `ยืนยันและไปเครื่องถัดไป` action. The final item shows totals for passed, follow-up, failed, and not-found results before closing the round.
- Evidence provides separate **ถ่ายรูป** and **เลือกจากคลัง** actions. The browser re-encodes to JPEG to remove EXIF metadata, limits the longest side to 2048 px, targets 2.5 MB, shows a preview, and reports upload progress.
- Inspection drafts are stored only in that browser's IndexedDB, including the compressed photo. They do not sync between phones, do not store presigned upload URLs, and are not uploaded automatically. After reconnection the operator must explicitly confirm again.
- QR/Code 128 scanning requests the rear camera only after `สแกนรหัส` is pressed. If `BarcodeDetector` is unavailable or camera access is denied, exact case-insensitive lookup through `กรอกรหัสอุปกรณ์` remains available.
- A quick marker tap opens Inspect. Holding for at least 250 ms arms free dragging across the full map. Dropping over a room changes `spaceCode`; dropping in a corridor clears it. Pinch-to-zoom and map panning continue to work when a gesture starts away from a marker.
- Position writes use Safety Editor permission, optimistic concurrency, audit data, immediate preview, and visual rollback/retry on failure. Moving a marker resets position verification to `unverified`.
- New equipment begins with a draggable draft marker at the map center. Confirm its position before completing registry fields; numeric X/Y remain under `พิกัดขั้นสูง` for desktop recovery.
- Marker edits affect the working copy only. The published safety-map snapshot remains unchanged until the existing release workflow publishes a new version.

All inspection controls have a minimum 44 px touch target, and the mobile action bar accounts for the device safe-area inset. Run `npm run test:lab-map-safety` plus the workflow, checklist, position API, and mobile-flow scripts before release. Physical acceptance is still required on iPhone/Safari and Android/Chrome.

## Chemical safety foundation import

The chemical-room importer is dry-run by default. It verifies the exact June 2026 master-list PDF and storage-layout image, recursively indexes the SDS archive, and prints one JSON summary. Dry-run does not initialize Supabase or R2 clients and does not need their credentials.

```powershell
npx tsx scripts/import-chemical-safety.ts --masterlist 'C:\Users\User\Downloads\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf' --layout 'E:\ISO\ISO15190\safety\ห้องสาร\ผังสารเคมี.png' --sds-root 'C:\Users\User\Downloads\MSDS 2568'
```

Checked source hashes:

- master list: `71d25b0e50b3056f97edb3238a1a7949584744f67fc0bfbfafcaa70273d83ddb`;
- storage layout: `5195b2f1d00672c3f625e464abc743ab9ef0ee2de6215bf64222453f5f7a951d`;
- current SDS archive manifest (`relativePath:sha256`, sorted): `1eb2b4ebf4b5f8fcf27eb41998887d3d2479b37e045acb9f7cdab5f4b8d34e6f`.

The reviewed baseline is 25 master-list rows, 13 positions, 521 PDF, 18 DOCX, 16 DOC, 1 HTML, 13 candidates, 7 mismatches, 5 missing products, and 5 quantity conflicts. A different summary blocks application until the source or association evidence is investigated.

Apply the schema only after confirming the configured Supabase project is the intended non-production environment:

```powershell
node scripts/run-migration.mjs scripts/chemical-safety-module.sql
```

For the existing chemical-safety module, apply the follow-up scripts in this order before deploying the corresponding UI: `scripts/chemical-safety-ghs-and-departments.sql`, `scripts/chemical-safety-registry-crud.sql`, then `scripts/chemical-safety-department-registry.sql`. The last script creates department-scoped registry holdings, links each department SDS file to at most one approved chemical, and keeps those holdings out of the room storage layout. The equivalent Supabase CLI migration is `supabase/migrations/20260808154713_chemical_safety_department_registry.sql`.

After that environment is explicitly confirmed and the dry-run has been reviewed, append `--apply` to the same import command. Apply uses the existing Supabase service-role and private R2 configuration. It reuses import batches by source kind/hash, upserts source rows by batch/row key, consolidates PDF evidence by SHA-256, and uploads only missing private objects below `chemical-safety/sources/` and `chemical-safety/imports/`.

Imports remain proposals or quarantined evidence: they do not create an approved SDS, public listing, QR token, product, or inventory holding. A custodian must verify the bottle label and exact SDS before a separate reviewer workflow can publish anything.

If application fails, inspect the matching `chemical_import_batches` row and its `failed` summary/error evidence plus `chemical_import_rows`; do not delete provenance rows. Correct the underlying environment or source problem, rerun the same source-bound command, and let the unique batch/hash and row constraints resume idempotently. Audit details contain counts and hashes, not local filesystem paths.

## Equipment-map PM/CAL work groups

This section applies only to `/staff/equipment/map` (the equipment map). It does not change the laboratory safety map, its geometry, routes, or safety data.

The mobile “พื้นที่ที่กำลังตรวจ” picker groups areas for a PM/CAL walk-through as follows:

| กลุ่มงาน | โซนย่อย/พื้นที่ |
| --- | --- |
| งานอณูชีววิทยา | อณูชีววิทยา, Extraction Room, Library Room, Sequence Room |
| ห้องปฏิบัติการกลาง | เคมีคลินิก+ภูมิคุ้มกัน, จุลทรรศนศาสตร์, โลหิตวิทยา |
| งาน OUTLAB | กรอบเดิม “ตรวจพิเศษและตรวจต่อ” ใช้ชื่อ “งาน OUTLAB” บนผัง; ตัวเลือกเดินตรวจคือ OUTLAB (โซน 1), OUTLAB (โซน 2) |
| งานคลังเลือด | คลังเลือด, คลังเลือด (crossmatch), คลังเลือด (แยกส่วนประกอบ), ห้องตะวันออกเฉียงใต้ 1, ห้องตะวันออกเฉียงใต้ 2 |
| งานจุลชีววิทยา | จุลชีววิทยา, มุมขวาบนจุลชีววิทยา, ห้องปฏิบัติการทิศเหนือ 1–3, โถง 1–3, ห้องน้ำ |

The PM/CAL work-group taxonomy is maintained in `lib/equipment-map/walk-groups.ts` as `EQUIPMENT_WORK_GROUPS` and re-exported by the equipment manifest; it is intentionally separate from `parentCode`, which remains the geometric containment rule for drawing and validating rooms/zones. All other areas remain standalone choices. In particular, electrical areas and Server rooms must never be assigned to a medical-technology work group.

Every work group has a “ทั้งงาน” choice. Molecular, central-lab, and microbiology use their real parent room as that summary. OUTLAB and blood bank use synthetic work-group summaries calculated from their declared inspection-area codes because neither has a safe geometric parent that represents only that work group. Selecting either synthetic summary shows the combined counts and equipment list without changing map geometry or saved equipment area codes.

`zone-special-testing` is the map container for งาน OUTLAB and is not a standalone inspection choice: its geometric children also contain the blood-bank crossmatch/component zones, so selecting that container would produce an incorrect combined PM/CAL count. The walk-through picker therefore calculates “ทั้ง งาน OUTLAB” from OUTLAB zones 1–2 only, while the map itself labels the container งาน OUTLAB.

For an existing Supabase environment, apply `scripts/equipment-map-areas-v7.sql` and then `scripts/equipment-map-areas-v8.sql` manually after the earlier equipment-map area scripts, then deploy the application. V8 corrects the OUTLAB/blood-bank code mapping and restores the standalone northwest/centre room names. These scripts only align saved display names; they do not alter area codes, geometry, parent relationships, pins, or the safety map. Application builds do not run SQL migrations automatically.

## Grouped PM/CAL planning

The equipment calibration workspace supports grouped plans and individual exceptions for any Thai fiscal year. A new year can start from the read-only 2566 template or from a selected prior year; both options create drafts and do not affect operational totals until staff select registered equipment and save.

Apply `supabase/migrations/20260728130000_pm_cal_plan_groups.sql` after the existing PM/CAL history migrations before deploying this UI. Per-unit groups calculate budget from selected equipment count; lump-sum planned and actual costs are stored once on the group. Legacy `calibration_plans` rows remain read-only and are excluded from current reports.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
