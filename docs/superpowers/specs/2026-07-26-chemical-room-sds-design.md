# Chemical Room, Chemical Registry, and Public SDS Design

**Date:** 2026-07-26  
**Status:** Approved visual direction; written specification awaiting user review  
**Module:** ความปลอดภัย  
**Initial room:** ห้องเก็บสารเคมี (`chemical-prep`)

## Objective

Add a chemical-safety workspace under the existing **ความปลอดภัย** module that turns the current chemical-room master list, storage plan, and SDS archive into controlled, auditable data.

The work has four connected outcomes:

1. an internal chemical registry and current-quantity snapshot for the chemical room;
2. a visual storage-layout view based on the current 13-position plan;
3. an SDS review and approval workflow using GHS data, with a public no-login SDS search covering every department;
4. an A4 landscape PDF export that retains the useful structure of the supplied master list.

This is a chemical registry, not a receive/issue stock system. It records the current editable quantity snapshot and its change history, but does not introduce transactional inventory movements.

## Approved User Experience

The approved direction is a **Safety Hub** with a compact operational overview and dedicated working views. It combines the high-level dashboard, the current storage map, and a detailed registry table instead of forcing users into separate disconnected tools.

The internal hub has four tabs:

- **ภาพรวม** — totals, outstanding review work, SDS coverage, and quantity conflicts;
- **ผังการจัดเก็บ** — the current A/B/C/T position grid and the chemicals assigned to each position;
- **ทะเบียนสารเคมี** — filterable chemical, package, quantity, GHS, SDS, location, and responsible-unit data;
- **ตรวจสอบการนำเข้า** — source rows, matching evidence, discrepancies, custodian decisions, and reviewer decisions.

At initial import, the overview is expected to show:

- 25 chemical products in the supplied master list;
- 13 storage positions;
- 13 plausible SDS candidates requiring verification;
- 12 products needing SDS resolution, comprising 7 mismatches and 5 missing files;
- 5 quantity arithmetic conflicts requiring confirmation.

These are import-review figures, not permanently hard-coded dashboard values.

## Navigation and Routes

The existing Safety sidebar parent and map route remain stable because active map work already uses them:

- `/staff/lab-map` — แผนที่ห้องปฏิบัติการ;
- `/staff/lab-map/chemicals` — ห้องสารเคมี / Safety Hub;
- `/staff/lab-map/sds` — internal SDS search and administration;
- `/sds` — public, no-login search for approved SDS from all departments.

The existing protected-path rule already covers every `/staff/...` route. `/sds` and the narrowly scoped public file endpoints must remain outside the protected-route match.

The internal sidebar opens the **ความปลอดภัย** group automatically for all three staff routes and shows the correct active child.

## Source Material and Import Baseline

### Chemical master list

The source PDF is:

`C:\Users\User\Downloads\Unit Chemical Inventory List ห้องเก็บสารเคมี (1).pdf`

It is a one-page A4 landscape document marked **Update June 2026**. It contains 25 chemical products and these source columns:

- sequence number;
- chemical name;
- SDS available yes/no;
- package/container volume;
- minimum stock;
- total volume;
- free-text GHS type;
- storage location;
- responsible unit.

The import preserves the original PDF, file hash, import time, source row, and raw cell values. Normalized registry values are stored separately so corrections never erase the source evidence.

### Storage plan

The source image is:

`E:\ISO\ISO15190\safety\ห้องสาร\ผังสารเคมี.png`

It is marked **วันที่ปรับปรุง: 2 กุมภาพันธ์ 2569** and defines the current 13 positions:

- A1, A2;
- B1, B2, B3, B4;
- C1, C2, C3, C4, C5;
- T1, T2.

The colors blue, green, orange, and purple identify the physical A/B/C/T location groups in the interface. They are not treated as GHS hazard colors. GHS classes and pictograms are displayed separately.

The plan resolves an ambiguity in the PDF. The PDF reports a shared `B3, B4` location for six chemicals, while the image assigns:

- B3: Acetic acid, Ethanol, Formic acid;
- B4: Permount/Toluene solution, Propan-2-ol, Xylene.

The normalized current location uses the image assignment. The raw `B3, B4` PDF value remains attached to the import row for traceability.

The complete initial normalized position mapping is:

- A1: 70% Alcohol; Alcohol hand rub;
- A2: Ethyl alcohol 95%;
- B1: Papanicolaou’s solution 1a (Harris hematoxylin); Papanicolaou’s solution 2a (OG6); Papanicolaou’s solution 3b (EA50);
- B2: Sodium acetate (anhydrous);
- B3: Acetic acid; Ethanol; Formic acid;
- B4: Permount/Toluene solution; Propan-2-ol; Xylene;
- C1: Formalin;
- C2: Ammonia solution 25%; Ammonia solution 28%; Ammonia solution 30%;
- C3: Acetonitrile; Dichloromethane;
- C4: Hydrochloric acid 37%; Sulfuric acid;
- C5: Citric acid; Trifluoroacetic acid;
- T1: Wright’s Baso;
- T2: Methanol.

### SDS archive

The source folder is:

`C:\Users\User\Downloads\MSDS 2568`

The initial scan found 556 files: 521 PDF, 18 DOCX, 16 DOC, and 1 HTML. Twenty-six PDFs are in the chemical-room subfolder, while relevant candidates also exist under other departmental folders.

Every candidate enters the system as a draft or quarantined import. A filename match alone never makes an SDS public. The reviewer verifies, at minimum:

- product/chemical identity and aliases;
- CAS number;
- concentration or grade;
- manufacturer/supplier and product code where present;
- SDS revision/effective date and language;
- GHS classification and label elements in SDS Section 2.

Files are deduplicated by SHA-256. Identical content may be associated with more than one department or product only when the association is reviewed and recorded.

## Initial Chemical and SDS Findings

The 25 names in the master list correspond to the chemicals displayed on the current storage plan. The import must flag rather than silently repair the following quantity conflicts:

- Ammonia solution 30%: `2.5 L × 2` but reported total `2.5 L`;
- Ethyl alcohol 95%: `500 mL × 7` but reported total `18 L`;
- Formic acid: `2.5 L × 1 + 1 L × 1` but reported total `2.5 L`;
- Methanol: `2.5 L × 1` but reported total `5 L`;
- Wright’s Baso: `5 L × 1` but reported total `50 L`.

The SDS archive analysis produced three provisional groups:

- **13 plausible candidates** — may match but still require label, CAS, concentration, and manufacturer/product verification;
- **7 mismatches** — Acetic acid candidate is sodium acetate; the ammonia candidates describe anhydrous ammonia gas; Ethyl alcohol 95% is not concentration-specific; the Trifluoroacetic acid candidate is TFA-d; and the Wright’s Baso candidate is not clearly the exact product;
- **5 missing** — Alcohol hand rub, Papanicolaou solution 2a (OG6), Papanicolaou solution 3b (EA50), Permount/Toluene solution, and Xylene.

The preliminary scan also found identical file hashes for several duplicated files. These duplicates are consolidated at file-blob level while preserving all source-path provenance.

The PDF's free-text hazard values and the storage plan's broad group labels are not authoritative GHS classifications. Some text appears inconsistent with the physical form of the listed material. The system must not auto-correct those entries or infer chemical compatibility from a storage color. A Chemical Custodian confirms them against the exact bottle label and the approved SDS.

## Roles and Approval Workflow

A new **Chemical Custodian** responsibility is separate from the existing Safety Editor role.

- **Authenticated staff:** view the approved internal chemical registry and approved internal SDS data;
- **Chemical Custodian:** import sources, create/edit product and holding drafts, propose GHS data, match SDS candidates, and submit for review;
- **Chemical Reviewer:** approve or reject product/SDS versions and quantity corrections;
- **Administrator:** appoint custodians/reviewers, manage room/location lifecycle, and retire records;
- **Public user:** search and open only current approved public SDS and the explicitly allowed safety manual, without login.

The state flow is:

`draft → in_review → approved/current`

An approved version may later become `superseded` or `retired`. A rejected submission returns to the custodian with a reason. The same person cannot approve their own submission. Every state change records actor, timestamp, before/after values, and reason where applicable.

Only the current approved SDS version is visible on `/sds` or through a QR link. Draft, mismatched, rejected, superseded, and missing items remain internal.

## Data Model

Names below describe domain responsibilities; the implementation plan may align exact SQL names with repository conventions without changing their meaning.

### `chemical_rooms`

- stable code, initially `chemical-prep`;
- room name and optional map-space reference;
- active/retired lifecycle;
- public/QR availability settings.

The schema supports additional rooms later, even though the first release manages one room.

### `chemical_storage_locations`

- room reference;
- stable position code such as A1 or C4;
- zone/group, location kind, display order, and active state;
- optional display geometry for future interactive plans.

### `chemical_products`

- canonical product name and searchable aliases;
- CAS number;
- manufacturer, supplier, and product code where known;
- concentration/grade and physical state;
- lifecycle and review metadata.

Product identity is separate from the current physical holding so the same product can have multiple packages, lots, locations, or departmental owners.

### `chemical_unit_products`

- product and organizational-unit references;
- unit-specific preferred name/alias where needed;
- active/retired lifecycle and custodian scope;
- public listing eligibility after approval.

The product catalog is global, while this association records which departments use or own the product. One exact approved SDS file can therefore serve multiple departments without duplicating the stored file. Public department labels derive from approved active associations, not from a single owner column on the product.

### `chemical_inventory_holdings`

- product, organizational-unit, and storage-location references;
- optional lot number;
- package size value/unit;
- current container count;
- minimum stock;
- reported total as imported;
- normalized calculated total and unit;
- optional received, opened, and expiry dates;
- effective/snapshot date;
- draft/review/current status.

Editing a current snapshot creates a history/audit version. There is no receive, issue, transfer, or balance ledger in this scope.

### `chemical_sds_versions`

- product reference;
- private object-storage key, original filename, SHA-256, size, and MIME type;
- original source path and optional authoritative source URL;
- manufacturer/supplier, product code, concentration/grade, language, and revision/effective dates;
- review due date where policy requires it;
- draft/review/approved/superseded/rejected status;
- submitter, reviewer, decision time, and decision reason.

Files remain private in object storage. Public users receive streamed responses through controlled application endpoints and never see internal storage keys.

### Structured GHS data

The approved SDS version owns the structured hazard record:

- GHS hazard class and category;
- pictogram codes GHS01–GHS09;
- signal word;
- hazard statement (H) codes/text;
- precautionary statement (P) codes/text;
- storage instructions and incompatibilities;
- concise emergency information where approved for display.

Raw imported hazard text remains available beside the approved structured data. The implementation follows the current GHS framework and the standard 16-section SDS structure; the system does not manufacture classifications when the exact SDS is absent.

### Import and audit tables

`chemical_import_batches` stores source type, source filename/path, hash, import time, parser version, and batch state. `chemical_import_rows` stores immutable raw extracted values, normalized proposals, match evidence, conflict flags, and custodian/reviewer decisions.

The importer is idempotent for the same source hash. Re-importing changed source material creates a new batch rather than overwriting prior evidence.

Custodian appointments, SDS state changes, holding changes, public-access changes, QR rotations, and PDF exports are included in the audit trail.

Custodian and reviewer appointments may be scoped to one or more organizational units. A person can act only within their assigned scope, while administrators retain cross-unit management access.

## Import and Reconciliation Flow

1. Register the master-list PDF as a source artifact and import all 25 rows with their raw values.
2. Seed the `chemical-prep` room and its 13 current position codes from the storage image.
3. Apply the image's B3/B4 assignment as the normalized proposal while retaining the ambiguous raw PDF value.
4. Index candidate SDS files across all archive subfolders. Calculate hashes and extract safe metadata without approving any file.
5. Score candidate matches using normalized name/alias, CAS, manufacturer/supplier, product code, concentration/grade, and file hash.
6. Show quantity conflicts, identity conflicts, missing data, and matching evidence in **ตรวจสอบการนำเข้า**.
7. Require the Chemical Custodian to compare unresolved items with the physical label and SDS Sections 1 and 2.
8. Require a separate reviewer decision. Publish only the current approved version.

Import failures are row-level where possible. One malformed row or unsupported legacy document does not discard the whole batch; it remains visible with an actionable error. Legacy DOC/DOCX/HTML files are source candidates but must be converted or replaced with a verified PDF before they can become the downloadable public SDS in the first release.

## Storage Layout View

The layout reproduces the logical structure of the supplied image rather than using the image as an uneditable background.

- A, B, C, and T groups retain their current visual identity;
- each position card shows its current chemical products and review warnings;
- selecting a position filters or opens the matching registry records;
- GHS pictograms are rendered from approved SDS data and remain visually separate from position-group color;
- missing, mismatched, or expired/review-due SDS states are clearly labelled and do not receive an approved indicator;
- the source plan image, revision date, and import batch remain accessible as provenance.

The view is responsive and keyboard accessible. It supports the initial 13 positions but derives cards from database records so more rooms and locations do not require hard-coded UI changes.

## Internal Chemical Registry

The registry supports search and filters for product name/alias, CAS, responsible unit, room, position, active state, SDS status, GHS class/pictogram, and review state.

The default table includes:

- chemical/product name;
- CAS and concentration/grade when known;
- package size and current container count;
- minimum stock and normalized total;
- current approved SDS status;
- GHS pictograms/signal word summary;
- current storage position;
- responsible unit;
- last effective/review date.

Conflicting imported totals show both the reported value and the calculated value until resolved. Changes are made through a draft and review flow, not direct mutation of approved history.

## Public SDS Library

`/sds` is accessible without authentication and searches approved SDS from **all departments**, not only the central chemical room.

The public result/card may expose:

- product name and approved aliases;
- CAS number;
- responsible department;
- manufacturer/supplier and product code where approved;
- SDS language, revision, and effective date;
- GHS pictograms, signal word, and approved hazard statements;
- view/download actions;
- authoritative source URL when recorded and safe to publish.

It must not expose:

- quantity, package count, minimum stock, or lot number;
- exact storage room/position;
- source filesystem paths or object-storage keys;
- draft candidates, matching scores, reviewer notes, or audit events;
- staff identity or internal workflow data.

The public query reads from an approved-current projection or equivalent fail-closed query. Removing approval, superseding a version, or retiring a product removes the listing immediately.

Public endpoints validate stable opaque identifiers, apply rate limits, set safe content disposition, and stream only validated files. PDF upload finalization checks size, MIME type, and PDF magic bytes before a file can enter review.

## Public QR Access

Stable, opaque, unguessable QR tokens may be assigned to a room, position display, or chemical product. A token resolves to the current approved public information, so replacing an SDS revision does not require reprinting every QR label.

Tokens can be revoked or rotated. Invalid, revoked, or unpublished targets return a safe not-found response and never fall back to draft or internal content.

## MN-LAB-02 Safety Manual

The public SDS page includes a prominent link to:

**MN-LAB-02 คู่มือความปลอดภัยห้องปฏิบัติการ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี**

The current repository record is Published, revision 09, but its generic document visibility is Internal. The safety module therefore uses a narrow public allowlist by stable document code:

- only `MN-LAB-02` is permitted through this endpoint;
- the document must be current, Published, and not deleted;
- a stable public link always resolves the latest qualifying revision;
- no other Internal document becomes public because of this exception;
- the underlying object-storage key is never exposed.

If the document is unpublished, deleted, or no longer allowed, the endpoint fails closed.

## Chemical Registry PDF Export

Authorized staff can export the registry to PDF from the internal table. The export uses the same server-side query and filters as the on-screen registry so record counts and status rules cannot diverge.

The output is A4 landscape, matching the supplied source format, and uses an embedded Thai Sarabun font. Its principal columns are:

1. No.;
2. Chemical Name;
3. SDS on file/status;
4. package/container volume;
5. current container count;
6. minimum stock;
7. total volume;
8. GHS classification;
9. storage position;
10. responsible unit.

The header includes **Unit Chemical Inventory List**, selected unit/department or scope, and the as-of date. Every page repeats table headers and includes page number, generated timestamp, and record count. Rows do not split across pages, and long Thai/English values wrap without clipping.

The export supports the current registry filters, including department, room, position, active/review state, SDS status, and GHS filter. The default export represents the current approved view.

Only a current approved SDS receives the affirmative/check indicator. Draft, mismatch, missing, expired, or review-due states are printed explicitly and cannot appear as approved merely because the source PDF said “yes”.

The download response is permission checked and uses `Cache-Control: private, no-store`. The filename contains the effective date and selected scope. The initial 25-row chemical-room export should remain visually comparable to the one-page source, while larger all-department exports paginate safely.

## Security and Privacy

- All write and approval routes require server-side role checks; client-side visibility is not authorization.
- Staff routes remain protected by the repository's session proxy.
- Public routes use an explicit safe-field projection and approved-current criteria.
- R2/object-storage keys, local source paths, review notes, lots, quantities, and exact locations never enter public DTOs.
- Uploads are private, size-limited, type-checked, and magic-byte validated.
- Public file responses apply rate limits and safe caching/content-disposition headers.
- Approval and public-access changes are auditable.
- Physical storage grouping and approved GHS classification require validation by the responsible laboratory safety personnel; software import rules do not replace that safety review.

## Error Handling and Operational States

- Unsupported or unreadable source files stay in the import batch with an error status and source provenance.
- Duplicate source hashes do not create duplicate approved versions.
- Ambiguous matches require a custodian choice and reviewer approval; the system never auto-publishes the highest-scoring candidate.
- Missing current SDS displays a clear internal warning and is absent from public results.
- A failed PDF export returns an actionable error and records no successful-export audit event.
- Public file or manual requests fail closed when state changes between listing and download.
- Empty filters, no-result states, offline/file-stream errors, and expired/revoked QR tokens have explicit Thai user messages.

## Testing and Acceptance

Implementation follows test-first development and covers the following.

### Permissions and workflow

- staff can view approved internal records but cannot edit without the custodian role;
- custodians can draft and submit but cannot self-approve;
- reviewers can approve/reject and administrators can appoint roles;
- superseded/rejected/draft records never enter public results.

### Import and reconciliation

- the supplied PDF imports 25 rows and the image seeds 13 positions;
- B3/B4 normalized assignments match the current plan while raw PDF data remains intact;
- all 5 quantity conflicts are raised;
- the provisional 13 candidate, 7 mismatch, and 5 missing SDS groups are represented for review;
- same-hash re-import is idempotent and duplicate SDS blobs are consolidated;
- row-level errors do not discard valid rows;
- raw source provenance is immutable.

### SDS and GHS

- name-only matches cannot be approved automatically;
- CAS, concentration, manufacturer/product, and hash mismatches are visible;
- GHS pictograms/classes/H/P data come from the approved exact SDS version;
- invalid PDF content is rejected even when the extension or MIME claim is PDF;
- replacing an approved version makes the previous version superseded and unavailable publicly.

### Public access

- `/sds` requires no login and searches approved records across departments;
- public DTOs exclude quantities, lots, exact positions, internal paths/keys, and workflow data;
- rate limiting and invalid/revoked token behavior are enforced;
- the stable MN-LAB-02 link serves the current Published allowed revision;
- another Internal document is denied by the same endpoint;
- unpublishing or retiring content immediately removes public access.

### PDF export

- page size is A4 landscape;
- Thai text remains extractable and correctly rendered;
- columns, filters, record counts, and approval statuses match the registry query;
- headers repeat, page numbers are correct, and rows are not clipped or split;
- draft/mismatch/missing SDS never prints an approved checkmark;
- rendered-page image comparison confirms the initial export remains recognizably consistent with the source master list.

### Navigation and quality gates

- sidebar active states work for all staff Safety routes;
- `/staff/...` routes remain protected and `/sds` remains public;
- desktop/mobile layouts, keyboard navigation, focus states, and pictogram alternative text pass review;
- focused tests, TypeScript checks, and a production Next.js build pass.

## Rollout

1. Apply schema and role changes in a non-production environment.
2. Import the three supplied sources into a preview batch without publishing.
3. Have the Chemical Custodian verify product identity, current quantity, position, and exact SDS/GHS data against physical labels.
4. Resolve the five quantity conflicts and every missing/mismatched SDS blocker.
5. Obtain separate reviewer approval.
6. Compare the generated PDF to the supplied master-list PDF and complete responsive/accessibility checks.
7. Enable `/sds`, the MN-LAB-02 public link, and QR targets only after approved-current data exists.
8. Sample the audit trail and public safe-field projection before production release.

The initial data remains visibly provisional until responsible safety personnel complete physical and SDS validation. The system must communicate that status instead of presenting imported assumptions as certified safety information.

## Standards References

The implementation and safety review use these authoritative references while treating the exact manufacturer's SDS and bottle label as the product-specific source of truth:

- [UNECE Globally Harmonized System of Classification and Labelling of Chemicals, Revision 11 (2025)](https://unece.org/transport/documents/2025/09/standards/globally-harmonized-system-classification-and-labelling);
- [OSHA Hazard Communication Standard, 29 CFR 1910.1200](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200), including the 16-section SDS presentation described by its appendices;
- [Thai Ministry of Industry GHS notification published by the Department of Industrial Works](https://www.diw.go.th/webdiw/wp-content/uploads/2021/07/law-haz-moi-12032555.pdf).

## Out of Scope

- receive/issue/transfer inventory transactions and balance calculations;
- procurement, purchase requests, or automatic replenishment;
- automatic chemical-compatibility decisions based solely on room colors or filenames;
- public disclosure of quantities, exact positions, lots, or internal review data;
- making all Internal controlled documents publicly accessible;
- converting every legacy DOC/DOCX/HTML archive file into an approved SDS automatically;
- support for additional rooms in the initial data migration, although the schema and UI are designed to support them later.
