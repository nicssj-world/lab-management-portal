# Chemical Safety Public SDS and Safety Manual Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a no-login SDS library for approved current SDS from every department, with safe file streaming, stable revocable QR entry points, and a narrowly allowlisted public link to the current Published MN-LAB-02 safety manual.

**Architecture:** A dedicated public repository constructs a strict safe-field projection from approved/current database rows. Public pages and Route Handlers apply per-instance request limits, never expose R2 keys, and re-check approval at download time; the manual endpoint bypasses generic `visibility = Public` only for the exact allowed document code and otherwise fails closed.

**Tech Stack:** Next.js 16.2.6 App Router/Route Handlers, React 19.2.4, TypeScript 5, Supabase service-role reads, private Cloudflare R2 streaming, existing request-protection utilities, Node `crypto`, `qrcode` 1.5.4, Node `assert` + `tsx` tests.

## Global Constraints

- Requires the foundation/import and internal-workflow plans.
- Source design: `docs/superpowers/specs/2026-07-26-chemical-room-sds-design.md`.
- `/sds` must work without login and include approved SDS associations from all departments, not only the chemical room.
- Public results include only current approved SDS/product/unit associations and safe GHS fields.
- Public results never include quantities, package counts, minimum stock, lots, exact room/position, local paths, R2 keys, draft candidates, match evidence, reviewer notes, audit records, or staff identities.
- Removing approval, superseding a version, retiring a product/unit association, or revoking a QR token removes access immediately; public SDS responses use `Cache-Control: no-store`.
- Public file endpoints stream through the application and never reveal object-storage keys or signed R2 URLs.
- `MN-LAB-02` is the only Internal controlled document allowed through the safety-manual exception. It must be current, Published, and not deleted.
- Do not change the generic document visibility or make another Internal document public.
- Public routes stay outside the protected-route regex; no `proxy.ts` change is required.
- GHS pictograms use vetted official GHS assets and always include text/accessible names; color alone never communicates a hazard.

---

### Task 1: Build the approved-current public projection

**Files:**
- Create: `lib/chemical-safety/public.ts`
- Create: `lib/chemical-safety/public.test.ts`
- Create: `lib/chemical-safety/public-types.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `searchPublicSds(filters): Promise<PublicSdsResult[]>`.
- Produces: `getPublicSdsFile(publicId): Promise<PublicSdsFile | null>`.
- Produces: `resolvePublicQrTarget(token): Promise<PublicQrTarget | null>`.
- Produces safe DTOs that cannot carry private registry/workflow fields.

- [ ] **Step 1: Write the failing safe-projection tests**

Use an injected source fixture containing approved, draft, superseded, retired, and multi-unit rows. Assert only approved/current active rows survive and one shared SDS can list multiple units without duplicate file records.

Recursively reject forbidden key fragments:

```ts
const FORBIDDEN = [
  'quantity', 'count', 'minimum', 'lot', 'location', 'room', 'position',
  'r2', 'sourcePath', 'review', 'submitted', 'actor', 'staff', 'audit', 'matchScore',
]

function assertPublicShape(value: unknown) {
  const json = JSON.stringify(value)
  for (const key of FORBIDDEN) assert.doesNotMatch(json, new RegExp(key, 'i'), key)
}
```

Also assert filters search product name/alias/CAS/manufacturer/unit/language/GHS and never relax approved/current predicates.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/public.test.ts`

Expected: FAIL because public projection modules do not exist.

- [ ] **Step 3: Define narrow public DTOs**

Create `public-types.ts`:

```ts
import type { GhsPictogramCode } from './types'

export interface PublicSdsResult {
  publicId: string
  canonicalName: string
  aliases: string[]
  casNumber: string | null
  concentration: string | null
  manufacturer: string | null
  supplier: string | null
  productCode: string | null
  units: Array<{ code: string; name: string }>
  language: string
  revisionLabel: string | null
  effectiveOn: string | null
  signalWord: string | null
  pictogramCodes: GhsPictogramCode[]
  hCodes: string[]
  hazardStatements: Array<{ code: string; text: string }>
  sourceUrl: string | null
  viewUrl: string
  downloadUrl: string
}

export interface PublicSdsFile {
  r2Key: string
  fileName: string
  contentType: 'application/pdf'
}

export type PublicQrTarget =
  | { kind: 'product'; publicProductIds: string[] }
  | { kind: 'collection'; publicProductIds: string[] }
```

`PublicSdsFile` is server-only and never serializes to a page/API result.

- [ ] **Step 4: Implement fail-closed database predicates**

`public.ts` is `server-only`. Query active products, active/public-eligible unit associations, and `chemical_sds_versions.status = 'approved'`. Read H/P code-and-text pairs only from the approved SDS version; do not synthesize statement text from an unrelated generic dictionary. Sort by Thai/English product name and deduplicate units.

`getPublicSdsFile` repeats every approval/current/lifecycle predicate rather than trusting a prior listing. It returns null for draft/superseded/retired/missing file.

`resolvePublicQrTarget` hashes the raw token with SHA-256, requires `chemical_qr_tokens.active = true`, resolves only approved-current products, and returns null when the target has no publishable SDS. It does not expose target room/unit names.

- [ ] **Step 5: Run and register projection tests**

Append `tsx lib/chemical-safety/public.test.ts` to `test:chemical-safety` and run:

```bash
npm run test:chemical-safety
```

Expected: all tests pass and forbidden-key scan is clean.

- [ ] **Step 6: Commit the public projection**

```bash
git add lib/chemical-safety/public.ts lib/chemical-safety/public-types.ts lib/chemical-safety/public.test.ts package.json
git commit -m "feat(chemical-safety): add safe public SDS projection"
```

---

### Task 2: Add public search/file endpoints and revocable QR management

**Files:**
- Create: `lib/chemical-safety/qr.ts`
- Create: `lib/chemical-safety/qr.test.ts`
- Create: `app/api/public/sds/route.ts`
- Create: `app/api/public/sds/[publicId]/file/route.ts`
- Create: `app/api/admin/chemical-safety/qr/route.ts`
- Create: `app/(public)/sds/q/[token]/page.tsx`
- Create: `scripts/chemical-safety-public-api.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces rate-limited `GET /api/public/sds` and `GET /api/public/sds/[publicId]/file`.
- Produces Admin-only create/list/revoke/rotate QR management; creation returns the QR SVG exactly once with the raw public URL.
- Produces no-login `/sds/q/[token]` resolution.

- [ ] **Step 1: Write failing QR helper tests**

Test that `createQrSecret()` returns at least 32 random bytes as base64url, `hashQrSecret()` returns deterministic 64-character hex, unequal tokens do not collide in fixtures, and only the hash is included in the database insert input.

- [ ] **Step 2: Implement QR secret helpers**

Use `randomBytes(32).toString('base64url')` and `createHash('sha256')`. Export:

```ts
export function createQrSecret(): string
export function hashQrSecret(secret: string): string
export function buildPublicQrUrl(origin: string, secret: string): string
```

Reject an origin that is not `https:` outside development. Do not log or audit the raw token.

- [ ] **Step 3: Write failing public API contracts**

Require both public endpoints to use `consumeClientRateLimit`, return 429 with `Retry-After`, apply `Cache-Control: no-store`, and use only the public repository. Require the file endpoint to support `Range`, `inline|attachment`, sanitized content disposition, and `r2ObjectResponse`; it must not call `getSignedUrl` or return JSON containing a URL/key.

Require dynamic handlers to use `RouteContext`/awaited params per Next.js 16.

- [ ] **Step 4: Implement public search and file streaming**

`GET /api/public/sds` parses q/unit/language/GHS/page with a maximum page size of 50, applies 300 requests per 10 minutes per hashed client IP, and returns `{ items, count }` with no-store headers.

`GET /api/public/sds/[publicId]/file` applies 120 requests per 10 minutes per client+publicId, re-resolves the approved file, loads it from R2 with optional Range, and streams it. Unknown/unapproved IDs return the same 404 response.

- [ ] **Step 5: Implement Admin QR create/revoke/rotate and one-time SVG return**

`POST /api/admin/chemical-safety/qr` requires `requireChemicalAdmin`, accepts a validated target type/id, creates a raw token, stores only its hash, audits the target (not raw token), renders `QRCode.toString(publicUrl, { type: 'svg', errorCorrectionLevel: 'M', margin: 2 })`, and returns `{ publicUrl, svg }` exactly once. `DELETE` or `PATCH enabled:false` revokes and audits. Rotation revokes the old row and creates a new row transactionally.

The UI downloads the returned SVG during the create/rotate response. There is deliberately no later image endpoint because the raw token cannot be recovered from its hash; if the SVG/public URL is lost, Admin rotates the token.

- [ ] **Step 6: Implement no-login QR resolution**

The page awaits `params`, rate limits by IP+token hash, calls `resolvePublicQrTarget`, and uses `notFound()` for invalid/revoked/unpublished tokens. Render the same public SDS result cards filtered to the resolved product IDs; do not display the internal room/position that produced the collection.

- [ ] **Step 7: Run and register API/QR tests**

Run:

```bash
npx tsx lib/chemical-safety/qr.test.ts
npx tsx scripts/chemical-safety-public-api.test.ts
npm run test:chemical-safety
```

Expected: all tests pass; static checks find no public signed URL or storage key.

- [ ] **Step 8: Commit public endpoints and QR flow**

```bash
git add -- lib/chemical-safety/qr.ts lib/chemical-safety/qr.test.ts app/api/public/sds app/api/admin/chemical-safety/qr "app/(public)/sds/q" scripts/chemical-safety-public-api.test.ts package.json
git commit -m "feat(chemical-safety): publish approved SDS safely"
```

---

### Task 3: Add the narrow MN-LAB-02 public safety-manual endpoint

**Files:**
- Create: `lib/chemical-safety/public-manual.ts`
- Create: `lib/chemical-safety/public-manual.test.ts`
- Create: `app/api/public/safety-manual/[code]/route.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `resolvePublicSafetyManual(code): Promise<PublicSafetyManualFile | null>`.
- Produces no-login streamed access to current Published `MN-LAB-02` only.

- [ ] **Step 1: Write the failing allowlist test**

With an injected document source, assert:

```ts
assert.equal(isAllowedPublicSafetyManualCode('MN-LAB-02'), true)
assert.equal(isAllowedPublicSafetyManualCode('mn-lab-02'), true)
assert.equal(isAllowedPublicSafetyManualCode('QP-LAB-01'), false)
```

Require Published + not deleted + non-empty `file_url`; Internal visibility is accepted only after the exact allowlist check. Draft/Approved/Obsolete/deleted/other code returns null. Assert the public DTO contains title/code/revision/effective date but not visibility, R2 key, reviewer, or internal metadata.

- [ ] **Step 2: Verify failure**

Run: `npx tsx lib/chemical-safety/public-manual.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the exact allowlist resolver**

Use:

```ts
export const PUBLIC_SAFETY_MANUAL_CODES = ['MN-LAB-02'] as const

export function isAllowedPublicSafetyManualCode(code: string) {
  return PUBLIC_SAFETY_MANUAL_CODES.includes(code.trim().toUpperCase() as 'MN-LAB-02')
}
```

Check the code before querying. Query `documents` by exact upper-case `document_code`, `status = 'Published'`, `deleted_at is null`, and non-null `file_url`. Generic visibility remains unchanged. Resolve the served key through the existing document-delivery helper with `audience: 'public'` and preview/download semantics so the safety exception still receives the repository's public document treatment.

- [ ] **Step 4: Implement rate-limited manual streaming**

The Route Handler awaits params, rejects a non-allowlisted code with 404 before database access, applies 60 requests per 10 minutes per client+code, loads the resolved R2 object with Range, and streams inline/download with no-store headers. It never redirects to a signed URL and never changes the document record's `visibility`.

- [ ] **Step 5: Run tests and commit**

Append the manual test to `test:chemical-safety`, then run:

```bash
npm run test:chemical-safety
npx tsc --noEmit
```

Expected: tests pass.

```bash
git add lib/chemical-safety/public-manual.ts lib/chemical-safety/public-manual.test.ts app/api/public/safety-manual package.json
git commit -m "feat(chemical-safety): expose MN-LAB-02 safety manual"
```

---

### Task 4: Build the no-login SDS library UI and public navigation

**Files:**
- Create: `app/(public)/sds/page.tsx`
- Create: `components/chemical-safety/PublicSdsLibrary.tsx`
- Create: `components/chemical-safety/PublicSdsCard.tsx`
- Create: `components/chemical-safety/GhsPictogram.tsx`
- Create: `components/chemical-safety/PublicSdsStyles.tsx`
- Create: `public/ghs/GHS01.svg`
- Create: `public/ghs/GHS02.svg`
- Create: `public/ghs/GHS03.svg`
- Create: `public/ghs/GHS04.svg`
- Create: `public/ghs/GHS05.svg`
- Create: `public/ghs/GHS06.svg`
- Create: `public/ghs/GHS07.svg`
- Create: `public/ghs/GHS08.svg`
- Create: `public/ghs/GHS09.svg`
- Create: `scripts/chemical-safety-public-ui.test.ts`
- Modify: `components/layout/PublicNav.tsx`
- Modify: `app/(public)/page.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces no-login `/sds`, searchable across departments, with the prominent MN-LAB-02 banner.
- Produces accessible official GHS pictogram rendering for all nine codes.

- [ ] **Step 1: Write the failing public UI contract test**

Require:

- public page exists outside `(protected)` and does not import auth guards;
- page/search API includes all-unit search rather than `chemical-prep` filtering;
- MN-LAB-02 banner links to `/api/public/safety-manual/MN-LAB-02?disposition=inline`;
- cards show product, CAS, units, manufacturer/revision/language, GHS pictograms, signal word/H statements, and view/download;
- no private-field labels or exact location/quantity text;
- all nine SVG assets exist and the pictogram component maps every GHS code with Thai/English accessible names;
- search/filter controls are labelled, keyboard accessible, responsive, and support empty/error/429 states.

- [ ] **Step 2: Verify failure**

Run: `npx tsx scripts/chemical-safety-public-ui.test.ts`

Expected: FAIL because the public page/assets do not exist.

- [ ] **Step 3: Add vetted official pictogram assets and an exhaustive component**

Use the nine official red-diamond GHS pictograms from the UNECE GHS Rev. 11 source set. Preserve their view boxes and symbol artwork; do not redraw simplified hazard symbols. Record source URL and retrieval date in an SVG comment. `GhsPictogram` uses an exhaustive `Record<GhsPictogramCode, { src; th; en }>` and renders a visible `GHS0x` fallback label plus `alt` text.

- [ ] **Step 4: Implement the public page and client search**

The page is a Server Component with `dynamic = 'force-dynamic'`, awaits `headers()`, applies `consumeClientRateLimit` before loading its initial approved-safe result page, and passes safe DTOs to a small Client Component. The client debounces search, fetches `/api/public/sds` with q/unit/language/GHS, mirrors filters in `URLSearchParams`, cancels stale requests, and renders explicit loading/empty/error/429 messages.

Show a top banner for MN-LAB-02 before search results. Open SDS/manual previews in a new tab with `rel="noopener noreferrer"`; downloads use the same controlled endpoint with attachment disposition.

- [ ] **Step 5: Add public discovery links**

Add **SDS / ข้อมูลความปลอดภัยสารเคมี** to `PublicNav` and a compact homepage safety card linking to `/sds`. Do not expose the staff Safety Hub from public navigation.

- [ ] **Step 6: Run public UI/security/build checks**

Append the UI test to `test:chemical-safety`, then run:

```bash
npm run test:chemical-safety
npm run test:security
npm run build
```

Expected: tests pass; build lists `/sds` and `/sds/q/[token]` as public dynamic pages.

- [ ] **Step 7: Commit the public SDS UI**

```bash
git add -- "app/(public)/sds" components/chemical-safety public/ghs components/layout/PublicNav.tsx "app/(public)/page.tsx" scripts/chemical-safety-public-ui.test.ts package.json
git commit -m "feat(chemical-safety): add public SDS library"
```

---

### Task 5: Public security and revocation acceptance gate

**Files:**
- Modify: `README.md`
- Modify: `scripts/security-hardening.test.ts`

**Interfaces:**
- Consumes Tasks 1–4.
- Produces a fail-closed public launch candidate for approved SDS and MN-LAB-02.

- [ ] **Step 1: Add security regression assertions**

Require rate limits/no-store on public search, SDS file, QR, and manual routes; exact manual allowlist; no signed URL; no R2/local paths; and `isProtectedPath('/sds') === false` while staff chemical routes remain true.

- [ ] **Step 2: Exercise public state transitions in non-production**

Verify:

1. approved SDS appears without login under every approved associated unit;
2. draft/rejected/mismatch/missing versions do not appear;
3. superseding or retiring removes the previous public file immediately;
4. an invalid/revoked QR returns 404 and never falls back to a draft;
5. MN-LAB-02 Published Rev. 09 opens without login;
6. another Internal document code returns 404 through the safety endpoint;
7. unpublishing/deleting MN-LAB-02 closes access immediately.

- [ ] **Step 3: Inspect public payloads**

Inspect HTML/RSC/API JSON and verify no quantity, count, lot, room, position, local path, R2 key, reviewer note, match score, or staff identifier is present. Check direct file endpoints with an unapproved `publicId` and modified QR token.

- [ ] **Step 4: Run the complete public gate**

```bash
npm run test:chemical-safety
npm run test:security
npx tsc --noEmit
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Document public operations and commit**

Document approval-to-public behavior, revocation, QR rotation, rate limits, safe fields, and the MN-LAB-02-only exception.

```bash
git add README.md scripts/security-hardening.test.ts
git commit -m "docs(chemical-safety): document public SDS controls"
```
