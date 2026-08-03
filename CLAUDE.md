# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js Version

This project runs **Next.js 16 / React 19** — APIs differ from training data. Before writing code, check `node_modules/next/dist/docs/` for the actual API. Key breaking changes:
- Route params are **async**: `{ params: Promise<{ id: string }> }` → must `await params`
- `createClient()` from `lib/supabase/server.ts` is **async** (returns a Promise) — always `await` it
- No `getServerSideProps` / `getStaticProps` — App Router only

## Commands

```bash
npm run dev      # Start dev server at localhost:3000
npm run build    # Production build (also type-checks)
npx tsc --noEmit # Type-check without building
npx tsx scripts/navigation-primitives.test.ts    # Shared navigation semantics
npx tsx scripts/navigation-routes.test.ts        # Nested route contracts
npx tsx scripts/navigation-query-state.test.ts   # URL-backed view contracts
npx tsx scripts/navigation-accessibility.test.ts # Navigation accessibility
npx tsx scripts/session-guard.test.ts            # Protected-path + transient auth-failure rules
npx tsx lib/risk/smart-rm.test.ts                # BE/CE date parsing, HIS field normalisation
npx tsx lib/risk/incident.test.ts                # IOR schemas + review-only field stripping
npx tsx lib/risk/register.test.ts                # L×S scoring + annual review cycle
npx tsx lib/risk/matrix.test.ts                  # Risk matrix bands, cells, movement
npx tsx scripts/lab-map-domain.test.ts           # Floor geometry, labels, route invariants
npx tsx scripts/lab-map-visitor-flow.test.ts     # Department→checkpoint table + visitor popup
npx tsx scripts/equipment-map-domain.test.ts     # Equipment map areas/zones vs LAB_SPACES geometry
npx tsx lib/equipment/pm-cal-due.test.ts         # PM/CAL due-date calculation from monthly plan
npx tsx scripts/equipment-map-ui.test.ts         # Equipment map UI contract + position-field lockdown
npx tsx scripts/activity-log-labels.test.ts      # Every audit_log action has a label + category in all 4 places (see README)
```

## TAT Local Source Files

TAT source exports live outside the repo under `E:\TAT\<fiscal-year>`, for example `E:\TAT\2569`. Rebuild TAT dashboard cache with `npm run tat:local` from those local files before deleting Supabase raw rows with `npm run tat:clean-raw`.

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

There is no `npm test` or lint script. Focused regression tests live in `scripts/*.test.ts` and run with `npx tsx`; production build and `npx tsc --noEmit` remain required verification.

## Architecture

### Route Groups

```
app/
├── (public)/          # Unauthenticated pages (catalog, contact, news, manual)
├── (protected)/       # Auth-gated; layout.tsx redirects → /login if no session
│   ├── staff/         # Main staff portal (sidebar + topbar layout)
│   ├── kpi/           # KPI dashboard module
│   ├── lab-workload/  # Workload tracking module
│   └── tat/           # Turnaround time module
├── api/admin/         # All mutation API routes (require auth + role check)
├── auth/              # Supabase auth callbacks
└── login/
```

### Auth & Permissions

Auth is enforced in `app/(protected)/layout.tsx` via Supabase server session. Role comes from `profiles.role` in the DB.

**Deep links survive login.** `proxy.ts` appends the original path+query as `?next=` when it bounces an unauthenticated user to `/login`, and the login page returns them there instead of always landing on `/staff/dashboard` — this is what makes a shared link or a QR code posted in the lab actually work. Both sides go through `safeReturnPath` in `lib/auth/session-guard.ts`, which only accepts internal paths that pass `isProtectedPath`; that allowlist is the open-redirect guard, so never loosen it to accept arbitrary values. The login page reads the param from `window.location` inside the submit handler rather than `useSearchParams`, which would force a `<Suspense>` boundary at prerender time.

Roles: `'Admin' | 'Manager' | 'Document Controller' | 'Medical Technologist' | 'Medical Science Technician' | 'Assistant'`

**Every API route that mutates data must check role:**
```ts
async function getActor() {
  const supabase = await createClient()           // server client (user session)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabaseAdmin            // service role to read profiles
    .from('profiles').select('id, role').eq('id', user.id).single()
  return data as { id: string; role: string } | null
}
const canEdit = ['Admin', 'Manager'].includes(actor?.role ?? '')
```

### Permission System

Module-level access is controlled by a **permission matrix** stored in the `role_permissions` DB table. Each role × resource combination has a level: `'none' | 'view' | 'edit'`.

**Behaviour:**
- `none` → module hidden in sidebar + redirect to `/staff/dashboard` if accessed directly
- `view` → module visible, all add/edit/upload/import buttons hidden
- `edit` → module visible + all mutation buttons shown
- `Admin` role always gets `edit` on every resource (hardcoded in `getRolePermissions`)

**Key files — never duplicate these constants:**

| File | Purpose |
|------|---------|
| `lib/permission-resources.ts` | **Single source of truth** — `RESOURCES` array and `PERMISSION_ROLES` order |
| `lib/permissions.ts` | Server-side `getRolePermissions(role)` helper (imports from above) |
| `context/PermissionContext.tsx` | Client context — `PermissionProvider` + `usePermission(resource)` hook |

**Adding a new module:**
1. Add the resource name to `RESOURCES` in `lib/permission-resources.ts` — it auto-appears in the Permission Matrix UI and `getRolePermissions` will enforce it.
2. Add `resource: 'ชื่อ Resource'` to the nav item in `StaffSidebar.tsx`.
3. In server component pages: call `getRolePermissions` and redirect if `none`, derive `canEdit`.
4. In client component pages: use `usePermission('ชื่อ Resource')` from context.

**Server page pattern:**
```ts
import { getRolePermissions } from '@/lib/permissions'
// ...
const perms = actor?.role ? await getRolePermissions(actor.role) : {}
if ((perms['ชื่อ Resource'] ?? 'none') === 'none') redirect('/staff/dashboard')
const canEdit = perms['ชื่อ Resource'] === 'edit'
```

**Client component pattern:**
```tsx
import { usePermission } from '@/context/PermissionContext'
// ...
const { canEdit } = usePermission('ชื่อ Resource')
```

**Do NOT** hardcode `['Admin', 'Manager'].includes(role)` to gate UI buttons — use the permission system above. The hardcoded pattern is only acceptable inside `allowedTransitions()` in DocumentsClient (document status workflow logic, not general access).

### Supabase Client Pattern

Three clients — use the right one or mutations will fail:

| Client | File | Used in |
|--------|------|---------|
| `createClient()` | `lib/supabase/client.ts` | `'use client'` components |
| `await createClient()` | `lib/supabase/server.ts` | Server Components, API routes (auth check only) |
| `supabaseAdmin` | `lib/supabase/admin.ts` | API routes for **all DB mutations** (bypasses RLS) |

**RLS blocks client-side mutations.** Any write from a Client Component must go through an `/api/admin/` route that uses `supabaseAdmin`.

Supabase returns a PromiseLike, not a full Promise. Use `.then(undefined, () => {})` instead of `.catch()` for fire-and-forget calls (e.g., audit log inserts).

### Data Layer

Query functions live in `lib/queries/` — each accepts a `supabase` client as the first argument:
```ts
getTests(supabase, filters)      // always pass the client, never create it inside
getCategories(supabase, activeOnly = true)
getTestDetail(supabase, id)
```

Validation schemas are in `lib/validations/` (Zod). API routes validate with `.safeParse()` and return 422 on failure.

### UI Component Library

**Do not install external UI libraries.** Use only `components/ui/`:
`Button`, `Card`, `Icon`, `Input`, `Select`, `Badge`, `PageHeader`, `Stat`, `EmptyState`, `MonthSelector`, `ModuleSubnav`, `ViewTabs`, `FilterChips`

Forms use **controlled components + `useState`** (no React Hook Form). Tables use **plain `<table>` HTML** with inline sort/filter state. Charts use **Recharts**.

**Styling: inline styles only** using CSS variables — no Tailwind on custom components, no CSS modules.

| Token | Value | Use for |
|---|---|---|
| `var(--bg)` | `#F7F9FC` | Page background |
| `var(--card)` | `#FFFFFF` | Card / panel |
| `var(--surface-2)` | `#F1F4F9` | Table header, skeleton, hover |
| `var(--border)` | `#E5EAF0` | Borders, dividers |
| `var(--ink)` | `#0F172A` | Primary text |
| `var(--muted)` | `#64748B` | Secondary text, labels |
| `var(--primary)` | `#1E5FAD` | Active state, CTA |
| `var(--primary-soft)` | `rgba(30,95,173,.10)` | Hover fill, drag-over |
| `var(--danger)` | `#DC2626` | Destructive actions |
| `var(--success)` | `#16A34A` | Success states |
| `var(--warning)` | `#D97706` | Warning states |

Dark mode is automatic via `[data-theme="dark"]` — never hardcode hex colors outside this token list.

Icon names come from the `ICONS` map in `components/ui/Icon.tsx` — check there before using an icon name. Available: `home, flask, book, doc, dash, users, shield, chart, beaker, bell, search, filter, plus, download, upload, eye, edit, trash, check, x, arrowRight, arrowLeft, globe, lock, menu, chevDown, chevRight, alert, clock, trending, settings, logout, inbox, microscope, pill, building, blood, petri, shieldCheck, syringe, cup, droplet, bloodBag, dna, cell, biohazard, phone, mail, moon, sun`

Component usage notes:
- `<Input onChange>` receives `(v: string) => void` — NOT a React change event
- `<Badge color>` options: `blue | teal | purple | amber | green | gray | red`; add `dot` prop for status indicators
- `<Card padding={0}>` for tables (handles overflow); `<Card padding={24}>` for panels
- `<Button variant>` options: `primary | secondary | danger | ghost`; accepts `icon` prop
- `<PageHeader marginBottom={n}>` — optional prop (default 24) to override bottom spacing; use `marginBottom={0}` when placing a stats row directly below the title

### UI Patterns

**Navigation hierarchy** — keep these meanings distinct:

- Sidebar = top-level module or large work group.
- `ModuleSubnav` = route-backed destinations inside a module. Define labels/icons/routes centrally in `lib/navigation.ts`; use semantic `<nav>`, Next.js `<Link scroll={false}>`, and `aria-current="page"`. Preserve existing query parameters when moving within the module.
- `ViewTabs` = views of the same data. Store state in `?view=` or `?section=`, preserve unrelated query parameters, validate values with `normalizeNavigationValue`, and fall back to the screen's default view for invalid values.
- `FilterChips` = temporary local filters. Use `<button aria-pressed>` semantics; never use `role="tablist"` for filters.
- Local `useState` tabs = only for non-shareable state, such as an import/form mode with unsaved input.

Current route-backed modules:

- EQA: `/staff/eqa`, `/programs`, `/rounds`, `/coverage`, `/capa`, `/settings` under `/staff/eqa`.
- OUTLAB: `/staff/outlab`, `/laboratories`, `/services`, `/certificates`, `/settings` under `/staff/outlab`.
- Risk: `/staff/risk`, `/report`, `/ior`, `/register`, `/smart-rm` under `/staff/risk`. Each is its own page + client component (no `[section]` catch-all).
- Satisfaction: `/staff/satisfaction`, `/surveys`, `/campaigns`, `/comments` under `/staff/satisfaction`.

EQA/OUTLAB settings must remain Admin-only both in navigation and direct-route loading. Keep the legacy OUTLAB `?tab=certificates` redirect and preserve its `filter` value. All current nested routes remain under `/staff`, so they are already protected by `proxy.ts`; only edit the proxy regex when introducing a new protected top-level prefix.

Navigation controls must keep a minimum 44 px target, visible 3 px `:focus-visible` outline, color/shadow-only transitions of 150–200 ms, `prefers-reduced-motion`, decorative icons hidden from assistive technology, and contained horizontal scrolling on narrow screens. Do not let navigation create whole-page horizontal overflow.

**Upload controls** — every file upload UI must support Drag & Drop in addition to click-to-browse. Use a visible drop zone with `dragover` feedback using `var(--primary-soft)`, keep keyboard-accessible file input/button behavior, and apply this consistently across documents, personnel evidence, imports, images, and any future upload feature.

**Pill filters** — use `FilterChips` instead of hand-rolling tab-like buttons. It supports count, disabled state, color markers, pressed semantics, keyboard focus, reduced motion, and compact visual density without reducing the hit target below 44 px. Include an "all"/clear item when the screen needs to reset a filter.

**Table rows** — hover effect:
```tsx
<tr
  style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
>
```

**Skeleton loading** — one `<div>` per cell:
```tsx
<div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: colIdx === 0 ? 200 : 80 }} />
```

**Toast hook** — bottom-right, auto-dismiss after 3.5s:
```tsx
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}
```

**Modal overlay** — do NOT add `onClick` close on the backdrop (project decision: X button only):
```tsx
<div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
  <div style={{ background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)' }}>
    {/* header | body | footer — each separated by borderBottom/Top: '1px solid var(--border)' */}
  </div>
</div>
```

**Form field style** (inside modals):
```tsx
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)', background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}
```

### Search Debounce Pattern

Use a `debouncedSearch` state to avoid stale-closure race conditions when combining `useEffect`-driven fetches with a search input:

```ts
const [search, setSearch] = useState('')
const [debouncedSearch, setDebouncedSearch] = useState('')

useEffect(() => {
  const t = setTimeout(() => setDebouncedSearch(search), search ? 350 : 0)
  return () => clearTimeout(t)
}, [search])

// fetchDocs depends on debouncedSearch (not search), so the fetch only fires after the delay
// Clearing search sets debouncedSearch immediately (0 ms) → restores full list without stale results
```

Do NOT use a manual `setTimeout` inside `onChange` and also a `useEffect` on `fetchDocs` — this causes double fetches and stale closures.

### PDF Generation Pattern

Generate printable PDFs client-side using an HTML Blob → `window.open` → auto-print:

```ts
const html = `<!DOCTYPE html><html>...</html>`
const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html; charset=utf-8' }))
const win = window.open(blobUrl, '_blank')
win?.addEventListener('load', () => {
  win.print()
  URL.revokeObjectURL(blobUrl)
}, { once: true })
```

CSS for print:
```css
@page { size: A4 portrait; margin: 8mm 10mm; }   /* or landscape for wide tables */
* { font-family: 'TH Sarabun New','Sarabun','Cordia New',Arial,sans-serif; }
```

Paginate by filling blank rows on non-last pages. Use `.page { height: 277mm; display: flex; flex-direction: column; }` with `margin-top: auto` on the footer.

### Topbar Page Titles

`components/layout/StaffTopbar.tsx` resolves Thai/English titles with `resolvePageTitle` from `lib/navigation.ts`. It selects the longest matching route, so a nested route wins over its module root. Add explicit `PAGE_TITLES` entries for new named screens; dynamic detail routes may intentionally fall back to their nearest parent title.

### File Storage

Documents are stored in **Cloudflare R2** (not Supabase Storage). Client: `lib/r2/client.ts` exports `r2` (S3-compatible) and `R2_BUCKET`. Key format: `documents/{type}/{year}/{timestamp}-{filename}`. Signed download URLs are generated via the `/api/admin/documents/[id]/read` route (POST to log access, GET for log viewer).

### Sidebar Active State

`components/layout/StaffSidebar.tsx` computes the active nav item by finding the **longest matching href** (not `startsWith`) to prevent prefix collisions (e.g., `/staff/tests` vs `/staff/tests/categories`).

Nav items are filtered by two independent checks (both must pass):
- `role: 'Admin'` — hard role gate (e.g., Settings, Categories); used only for items that must always be Admin-only regardless of permission matrix
- `resource: 'ชื่อ Resource'` — hides the item when `userPermissions[resource] === 'none'`; permissions come from `lib/permission-resources.ts` via the layout

### Language Support

`context/LangContext.tsx` provides `useLang()` → `{ lang: 'th' | 'en' }`. Hardcode both languages directly in components; there is no translation file.

### API Route Pattern

```ts
// app/api/admin/[resource]/route.ts
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEdit) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  // parse body → zod validate → supabaseAdmin mutation → return result
}
```

Audit log writes (non-critical) use fire-and-forget:
```ts
supabaseAdmin.from('audit_log').insert({ action, user_id, target, detail })
  .then(undefined, () => {})
```

### Database Migrations

SQL scripts are in `scripts/`. Run them manually via **Supabase Dashboard → SQL Editor**. There is no automated migration runner for schema changes.

`audit_log` has no automatic retention and grows indefinitely. `scripts/archive-audit-log.sql` moves rows older than 1 year into `audit_log_archive` (cold storage, not deleted — it's the QMS audit trail). There is no cron in this project; it has to be re-run manually/periodically (see README "Maintenance").


### Soft Delete Pattern

Documents use soft delete: `deleted_at timestamptz DEFAULT NULL`. GET queries always filter `.is('deleted_at', null)`. The purge route (`DELETE /api/admin/documents/purge-deleted`) hard-deletes soft-deleted records and cleans R2 files.

### Test Catalog Extended Columns

The `tests` table has extended columns added via migrations (not in the original schema). The `Test` interface in `lib/supabase/types.ts` marks these as optional (`?`):

| Column | Type | Notes |
|--------|------|-------|
| `contact_staff` | `boolean` | Show animated red "ติดต่อเจ้าหน้าที่ ก่อนเก็บตัวอย่าง" badge on public catalog detail page (`components/tests/TestDetailCard.tsx`) |
| `related_doc_ids` | `uuid[]` | Links to `documents.id` — shown as searchable multi-select in TestForm Section G |

The `contact_staff` badge uses CSS `@keyframes contactStaffPulse` + `contactStaffShimmer` injected via `<style>` in `TestDetailCard`. It renders **first** in the badge row, before the E-Phis code pill.

### PDF Text Extraction (Documents Module)

`app/api/admin/documents/extract/route.ts` extracts text from uploaded files for auto-filling the upload form. Uses:
- **PDF**: `unpdf` (`getDocumentProxy` + `extractText`) — pure JS, Vercel serverless compatible. Do NOT use `pdf-parse` (v2 requires `canvas`/`DOMMatrix` which is unavailable in Node.js serverless).
- **DOCX**: `mammoth`
- **XLSX**: `xlsx`

`next.config.ts` `serverExternalPackages` contains `['canvas']` only — `pdf-parse` is NOT in the list.

### Public Manual Page Architecture

`app/(public)/manual/` — lab services manual for public users.

- **`data.ts`** — single source of truth for ALL structured content: `PHONE_DIRECTORY`, `TEAM`, `CONTAINERS`, `CRITICAL_VALUES`, `OUTLAB_PARTNERS`, `OUTLAB_TESTS`, `MANUAL_SECTIONS`. Edit here to update tables/lists without touching JSX.
- **`ManualShell.tsx`** — layout shell with sticky sidebar nav + phone directory card. Nav uses CSS class `.manual-nav-btn` / `.manual-nav-active` for hover effect (translateX + primary-soft background).
- **Section files** (`sections/Manual*.tsx`) — prose/step content per chapter. Edit these for paragraph-level content changes.

### Documents Module DB Tables

| Table | Purpose |
|-------|---------|
| `documents` | Main records. Has `deleted_at`, `obsolete_date`, `obsolete_reason`, `reviewer_name`, `approver_name`, `review_confirmed_at/by/by_name`, `last_reviewed_at`, `read_audience_depts` |
| `document_revisions` | Version history. Has `approved_by`, `revised_by`, `revision_note`, `file_url`, `file_name`, `history_source` (`workflow`/`backfill`/`legacy`/`review`) |
| `document_access_logs` | Audit log. Actions: `upload`, `download`, `edit`, `delete`, `view` |

Auto-revision: PATCH handler always fetches current doc; if revision number changes OR a new file is uploaded, the old state is saved to `document_revisions` before updating.

Status workflow: `Draft → Review → Approved → Published → Obsolete`. Transitioning to Obsolete auto-sets `obsolete_date`; leaving Obsolete clears both `obsolete_date` and `obsolete_reason`.

### Document Types

`lib/validations/document.ts`'s `DOC_TYPES` is the single source of truth for valid `documents.type` values (feeds the zod schema). `lib/documents/type-labels.ts` re-exports it and adds `TYPE_LABEL` — the "ชื่อเต็ม (Code)" display string for each type (e.g. `QM: 'คู่มือคุณภาพ (QM)'`). Every filter/dropdown/category view imports from `type-labels.ts` rather than hand-rolling its own label map — this used to be duplicated across ~6 files with inconsistent Thai wording; don't reintroduce that.

Current types, in required display order: `QM, QP, WI, Reference, Form, Card file, Lb, Manual, Policy, Others`. `Record` was removed (unused, 0 documents). `QM` (Quality Manual) was split out of `Manual` — a `QM-`prefixed document code auto-detects type `QM`, not `Manual`, via `TYPE_BY_PREFIX` in `DocumentUploadModal.tsx`.

Per-file icon/badge *colors* (`TYPE_ICON_BG/FG`, `TYPE_COLORS`) are intentionally **not** consolidated — each file keeps its own color map; just keep it in sync with the current type list when types change.

Compact table/badge cells (MasterListClient rows, DocumentsClient library table, ManualClient public badges) show the bare type code; filters, dropdowns, category headers, and dashboard bars show the full `TYPE_LABEL`.

### Quick Update ("Upd+")

For non-controlled types (everything except QM/QP/WI/Manual — Reference, Form, Card file, Lb, Policy, Others), `DocumentsClient.tsx` shows an "Upd+" button instead of "Rev+" on Published documents with no active draft. `components/documents/QuickUpdateModal.tsx` orchestrates the same revision-draft endpoints Rev+ uses (create draft → presign/upload → finalize) in one dialog instead of the full revision panel:
- **Admin/DCC**: finalizes straight to `Published` — one-shot (archives the old file, Rev+1).
- **Reviewer**: finalizes to `Approved` — queues in the pending page's "รอเผยแพร่" bucket, where a green one-click "Published" button lets DCC/Admin publish it without opening the full revision panel.

`PATCH /api/admin/documents/[id]/revision-drafts/[draftId]` enforces server-side that only Admin/DCC may set a draft's status to `Published` (Reviewer → `Approved` is fine; Reviewer → `Published` is rejected with 403). This guard applies to both Upd+ and the ordinary Rev+ flow — do not remove it.

### Quality Document Workflow V2

This section supersedes the older auto-revision notes above.

Schema lives in `scripts/quality-document-workflow-v2.sql`. Run it manually in Supabase SQL Editor before testing workflow v2 in a real database.

Current tables and meaning:
- `documents`: current document record. `file_url` is the current official file. QP/WI official file is the generated final PDF after Published.
- `document_revision_drafts`: one active working revision draft per Published document. Used for content changes before promotion.
- `document_revisions`: archived previous versions and retroactive history. Workflow rows are immutable. Backfilled rows use `history_source = 'backfill'`.
- `document_status_history`: status transition history for `Draft`, `Review`, `Approved`, `Published`, `Obsolete`.
- `document_access_logs`: read/download/edit audit trail.

Core invariants:
- `file_url` means "current official file".
- Word/Excel source uploads must never automatically overwrite or promote into `file_url`.
- Published documents are immutable for content/status/revision/workflow dates.
- Published content changes must go through a working revision draft.
- Status changes are done through status actions/routes, not mixed into the upload/edit modal.
- Server routes must enforce transitions even if UI buttons are hidden.

QP/WI:
- QP/WI use system cover page and signature stamp.
- Draft can have Word/Excel source without official PDF.
- Edit/Review date is the source draft upload date.
- DCC/Admin reviews the draft, uploads content PDF without cover, then moves Draft -> Review.
- QP/WI cannot move Draft -> Review unless both the Word/Excel source file and the content PDF are present.
- Manager/Admin can move Review -> Approved; this sets `approved_at` and `approved_by_id`.
- Only Quality Manager, Laboratory Director, and Admin can move Approved -> Published; this sets effective/published fields, generates cover PDF, merges cover + content PDF, stores the generated final PDF in R2, then points `documents.file_url` to that generated PDF.

Legacy import Rev.>0:
- Use for existing controlled documents migrated from Google Drive or an old system.
- Admin and Document Controller can create an imported current document as `Published` immediately.
- Imported current documents must upload the current official file during creation.
- QP/WI imported current files must be the existing official PDF with legacy cover already included.
- Set `legacy_cover_included = true` for imported QP/WI current files and do not regenerate/merge a system cover for that imported current file.
- Add previous revisions afterward as retroactive/backfilled history.
- The next content change must use a working revision draft; the next Published revision should clear imported-current markers and use the new system cover.

Form/Record/Reference/Card File and other non-cover types:
- Use status, revision, and history.
- Do not generate cover pages.
- Do not stamp signatures into files.
- Official file may be PDF/DOC/DOCX/XLS/XLSX as appropriate.

Working revision drafts:
- Use `/api/admin/documents/[id]/revision-drafts`.
- Only one active draft per document is allowed by `document_revision_drafts_one_active`.
- Publishing a draft archives the current `documents` row into `document_revisions`, then promotes the draft into `documents`.
- Do not re-enable current revision rollback.
- Do not allow direct edits/deletes to workflow-generated `document_revisions` rows.

Retroactive revision history:
- Needed for migrated legacy documents that already had many revisions in an outside system.
- Admin and Document Controller can add backfilled history entries.
- Backfilled entries must not change the current document, `file_url`, status, or revision.
- Backfilled rows have `history_source = 'backfill'`.
- Only backfilled rows can be edited/deleted directly; workflow rows stay immutable.

Cover/header handling:
- QP/WI cover page is generated by the system and is independent from Word/PDF content headers.
- DOCX/XLSX header fill only patches header parts that exist in the uploaded source file.
- If a section/page has no header, header replacement must not crash and should leave that section/page unchanged.
- Missing source headers should be warning-level during Draft/source upload; the official QP/WI artifact is the final generated PDF.
- Before moving QP/WI forward, prioritize validating that the content PDF exists and the generated cover/final PDF is correct.

### DCC Enhancements (ISO 15189 8.3)

Schema in `scripts/add-document-annual-review.sql` (adds `documents.review_confirmed_at/by/by_name`, `documents.last_reviewed_at`, `documents.read_audience_depts`, and extends the `document_revisions.history_source` check to allow `review`). Run it manually in Supabase before testing these features.

Obsolete watermark:
- Transitioning a document to `Obsolete` stamps a diagonal "OBSOLETE / ยกเลิกใช้งาน + date" watermark onto every page of the official PDF (`lib/documents/obsolete-stamp.ts`), applied in the `[id]` PATCH handler.
- Only when `file_url` is a PDF (Office files are skipped). The pre-stamp key is kept in `cover_metadata.pre_obsolete_file_url` for recovery; the original R2 object is not deleted. Stamp failure is non-fatal (status change still succeeds, warning pushed).

Annual review workflow — **review-only model** (`lib/documents/review.ts`):
- `REVIEW_TRACKED_TYPES = QP/WI/Manual/QM` drives the "ต้องทบทวน" badge (due = latest of `last_reviewed_at`/`edit_date`/`expiry_date` + 1 year; window opens 90 days before due).
- `REVIEW_ONLY_TYPES = QP/WI` — only these get the "ทบทวนแล้ว" action + bulk. Manual and QM (QM used to be bucketed under Manual; now a separate type — see "Document Types" below) have no cover page and get no system-appended history at publish, so they must go through a normal Rev+ (they still show the reminder badge).
- Reviewer/DCC/Admin confirm via `POST /api/admin/documents/[id]/confirm-review` (sets `review_confirmed_*`). Confirmed docs queue in the pending page's "รอทบทวนประจำปี" section.
- DCC bulk via `POST /api/admin/documents/bulk-annual-review` (`{ ids }`): for each QP/WI doc it inserts a `document_revisions` row (`revision_number='-'`, `history_source='review'`, note "ทบทวนแล้ว ไม่มีการแก้ไข", `revised_by` = person who confirmed, `approved_by` = current Quality Manager for WI / Laboratory Director for QP), regenerates ONLY the appended history page (strip old marker pages + append fresh), and sets `last_reviewed_at`. **Revision, effective date, footer, cover, and body are never changed.** `published_at` is untouched, so read-report counters do not reset.
- `sortRevisionRows` (revision-history-pdf) sorts by date primarily so the `-` review rows slot in chronologically; identical output for normal revisions. The full Rev+ flow is unchanged.

Read-compliance report (`/staff/documents/read-report`, gate: Admin / DCC / Quality Manager / Laboratory Director):
- Per Published QM/QP/WI/Manual document (query derives the type list from `REVIEW_TRACKED_TYPES`, not a hardcoded array — keep it that way), shows read count X/Y with a per-document audience denominator. `documents.read_audience_depts` (null/[] = all active users; otherwise `profiles.dept ∈ list`, using `user-schema DEPARTMENTS`, NOT `documents.department`). Set per-document in the upload modal or in bulk via `POST /api/admin/documents/bulk-read-audience`.
- "Read" counts distinct `document_access_logs` views with `created_at >= published_at`, so a real Rev+ (new `published_at`) resets counts while review-only does not. Old view logs are never deleted.

### Satisfaction Survey Builder

Schema and four-form seed: `scripts/satisfaction-survey-module.sql`. Apply it manually; application code must not mutate the remote schema during build/deploy.

Core invariants:
- Staff route is `/staff/satisfaction/*`, already covered by the `/staff` regex in `proxy.ts`. Public `/s/[token]` must remain outside protected routing.
- Resource key is exactly `แบบสำรวจความพึงพอใจ`. Only Admin/Manager may change comment read state or export comment content; other permitted roles are view-only for comments.
- Published definitions are immutable and campaigns are permanently bound to one published version.
- There is no permanent survey-delete action. `ยกเลิกฉบับร่าง` removes only the active draft: it returns to the preceding published version and restores its title/description. If the first draft has never been published, the survey is archived instead. Apply `scripts/satisfaction-draft-discard.sql` once to existing environments that already ran the base script.
- Public clients use only `/api/satisfaction/[token]`; never expose service-role credentials or grant public raw-table access.
- Anonymous responses contain no user ID, name, HN, permanent IP, or User-Agent. One-per-device stores a campaign-bound HMAC of an HttpOnly cookie, not a device fingerprint.
- Submission is idempotent by `(campaign_id, submission_key)` and commits response/answers/device/event atomically through `submit_survey_response`.
- Realtime listens only to `survey_response_events`, then refetches aggregate APIs. Do not subscribe clients to raw answers/comments.
- Satisfaction score is `sum(score) / sum(max score for each answered scored question) * 100`; missing optional answers are excluded. Positive-response rate is secondary.
- KPI publication requires survey `edit` + KPI `edit`, a closed campaign, and no existing metric/year row. Never overwrite historical `kpi_satisfaction` data.

### Risk Management (three separate systems)

Schema: `scripts/risk-module-v2.sql`. Apply it manually before testing. It renames the old `risks` table to `risks_legacy` (kept — it's a QMS record) and splits it into three tables with genuinely different lifecycles. **Do not merge them back.**

| Table | What it is | Lifecycle |
|---|---|---|
| `smart_rm_events` | Incident data imported from the hospital HIS, for analysis only | None. No status, no L×S, no residual, no actions |
| `incident_reports` | IOR the lab handles itself (ISO 15189 **8.7**) | `reported → reviewing → action → monitoring → closed` |
| `risk_register` | Proactive risk assessment (ISO 15189 **8.5**) | `open → treating → monitoring → accepted/closed` + annual review |

Core invariants:

- **IOR uses severity A–I only. The register uses L×S + residual only.** These are incompatible vocabularies; the old single `severity_level` column held both (Thai words *and* letters), which is what forced `isRiskAssessment` branching throughout the old code. Keep them apart.
- `risk_register.score`, `level`, `residual_score`, `residual_level` are **generated columns** — the DB derives them from L×S. They cannot be written from application code, and zod schemas must not include them. This is what guarantees the level always matches the score.
- An IOR that reveals a systemic risk is **escalated** into the register via `incident_reports.escalated_register_id` (`POST .../incidents/[id]/escalate`). That is the only bridge between 8.7 and 8.5 — don't give IOR its own residual fields.
- `risk_actions` and `risk_attachments` use two nullable FKs (`incident_id` / `register_id`) with a check constraint that exactly one is set — same pattern as `eqa_attachments`.
- Deletes are soft (`deleted_at`); every GET filters `.is('deleted_at', null)`.
- `syncIncidentStatus` must return early when status is `closed`. Editing an action on a closed record must never silently reopen it.

**There is exactly one way to create an incident: `/staff/risk/report`.** It is a standalone page, not a modal, and it does **not** render `ModuleSubnav` — so `report` must stay out of `RISK_NAVIGATION` (a tab leading to a page with no tab strip strands the user and marks no tab `aria-current`). The IOR registry's "บันทึกอุบัติการณ์" button is a `<Link>` to that page, not a second form. Do not reintroduce `POST /api/admin/risk/incidents`; `POST .../incidents/report` is the only creation route and it always sets `reported_by` from the session, which is what makes every record traceable under ISO 15189 8.7.

Recording on behalf of someone (phone call, paper form): the report form shows a "ผู้รายงาน" field only when the user has `edit`, and the route accepts that name only after re-checking `canEditRisk`. `reported_by` still records who submitted it — never trust the client for that.

Permissions — three distinct levels, do not conflate:

| Action | Gate |
|---|---|
| Report an incident (`/staff/risk/report`) | Signed in. **No permission check** — gating reporting is what kills incident-reporting culture |
| Edit factual fields, record on behalf of another reporter | `canEditRisk` (permission matrix, `ความเสี่ยง / Rejection`) |
| Review, set severity, RCA, actions, residual, close | `canReviewRisk` (Admin/Manager — quality judgement, not data entry) |

`stripReviewOnlyFields` in `lib/risk/fields.ts` enforces the second/third split server-side and returns `warnings` listing what it dropped. It lives apart from `lib/risk/access.ts` so it stays testable without Supabase.

Sidebar: the risk group is a submenu whose **parent carries no `resource`** — each child carries its own instead, and the report child carries none. `isEntryVisible` in `StaffSidebar.tsx` checks the parent's `resource` and returns `false` *before* looking at children, so putting the gate on the parent would hide incident reporting from exactly the users it exists for. Keep the report child first in the list: `parentHref` falls back to the first visible child, so a user who can only report still gets a working group link. `scripts/navigation-routes.test.ts` guards both facts.

Why the guarantee must be structural rather than configured: the permission matrix is editable at runtime, so an admin setting `Assistant → none` on `ความเสี่ยง / Rejection` (a reasonable call — assistants don't need to browse the register) would otherwise silently remove their ability to report incidents, and nobody would connect the two. Separately, roles outside `PERMISSION_ROLES` (e.g. a `profiles.role` of `Document Controller`) never get rows written by `/api/admin/permissions`, so they resolve to `none` everywhere.

UI rules specific to this module (`components/risk/shared/tokens.ts` is the single source for meaning → visual):

- **Never convey meaning by colour alone.** Every severity/level/status indicator carries a letter, word, or icon as well. `RiskMatrix` shows counts as numbers, has a numbered legend, keyboard-reachable cells, and a "view as table" fallback.

**Risk matrix** — all matrix logic lives in `lib/risk/matrix.ts` (pure, tested in `matrix.test.ts`); `components/risk/RiskMatrix.tsx` only draws, and `lib/risk/matrix-pdf.ts` reuses the same `cellsFor` so the exported PDF always matches the screen. `MATRIX_BANDS` thresholds must stay in sync with the generated `level` column in `scripts/risk-module-v2.sql` and `riskLevel` in `shared/tokens.ts` — the test asserts all three agree across scores 1–25.

- Three views via `?matrix=inherent|residual|movement` (`ViewTabs`). The movement view draws lines from inherent to residual positions — hollow circle at the start, filled at the end, so direction reads without colour. It is the only view that answers "did the treatment work"; two side-by-side grids cannot.
- **Lines are aggregated per cell-pair, not per risk** (`movementFlows`). One line per distinct route, thickness and a label showing how many risks took it. Drawing one line per risk does not survive a real register — 150 risks would be 150 lines over 25 cells. Line count now grows with the number of distinct routes, which stays small. Risks that never left their cell get a counted ring instead of a zero-length line.
- The movement view hides per-cell counts: the message is the routes, and end markers would cover the numbers anyway. It also states how many routes are drawn out of how many assessed risks, so an empty-looking matrix is explained by the pending residual assessments rather than looking broken.
- The arrow layer is a **grid item spanning `grid-column: 2 / -1; grid-row: 2 / -1`** with percentage coordinates — no `ResizeObserver`, and no `viewBox`/`preserveAspectRatio="none"` (which distorts strokes when cells aren't square).
- Cells are only clickable in the inherent/residual views; in movement view a cell is both a source and a destination so drilling down would be ambiguous.
- **The matrix excludes `closed` risks but keeps `accepted` ones**, matching the `residualHigh` KPI. Before this, the matrix counted closed risks while the KPI beside it did not, so the two disagreed. Say so in the caption — the number has to be explainable during an audit.
- PDF colours are literal RGB in `matrix-pdf.ts` because PDFs can't read CSS variables; keep them in step with `MATRIX_BANDS`.
- Filters live in the URL (`useUrlFilters`), not `useState`, so back-navigation and shared links work and KPI cards can deep-link into a filtered list.
- L and S are picked with labelled 1–5 radio scales (`ScalePicker`), never a bare number `<select>` — the labels are what make scores comparable between assessors.
- The public report form auto-saves a draft to `localStorage`, validates on blur, and focuses the first invalid field on submit.

### งาน IT

Schema: `scripts/it-access-module.sql` (+ `add-it-access-editors.sql`, `add-it-access-review-approval.sql`) and `scripts/it-visitor-log.sql`. Apply manually.

Three of the four screens share the resource `ระบบสารสนเทศ (IT)` and the guard `requireIt` in `lib/it-access/guard.ts`; **the visitor log deliberately does not** (see below). `getPermissionsWithItOverride` upgrades a `it_editors` member ("คณะทำงาน IT") to `edit` on the IT resource only. Routes live under `/api/admin/it-access`, `/api/admin/it-downtime`, `/api/admin/it-backup`, `/api/admin/it-visitors` — note the folder names are `it-*`, not a nested `it/`. This module uses sidebar children, **not** `ModuleSubnav`, so there is no `IT_NAVIGATION` in `lib/navigation.ts`.

**The IT sidebar group's parent carries no `resource`** — each child carries its own. `isEntryVisible` in `StaffSidebar.tsx` checks the parent's `resource` and returns `false` *before* looking at children, so putting `ระบบสารสนเทศ (IT)` back on the parent would hide the visitor log from every Medical Technologist who isn't on the IT committee — i.e. from almost everyone the visitor log exists for. `parentHref` falls back to the first visible child, so a user who can only see the visitor log still gets a working group link. Same structural rule as the risk group; `scripts/it-visitor-log.test.ts` guards it.

### บันทึกการเข้า-ออก (Visitor Log)

Schema: `scripts/it-visitor-log.sql`. Replaces a Google Form. One permanent QR → `/v/[token]` → the visitor picks **รายบุคคล** or **หมู่คณะ**, then fills the form themselves.

- **Resource is `บันทึกการเข้า-ออก`, not `ระบบสารสนเทศ (IT)`.** Seeded `edit` for Manager / Medical Technologist / Medical Science Technician; Assistant gets no row (`none`); Admin is `edit` by hardcode. Guard is `requireVisitorLog` in `lib/it-visitor/guard.ts` — it uses plain `getRolePermissions` with **no `it_editors` override**, because the rule is "every role except Assistant", adjustable from the Permission Matrix.
- **Deleting is Admin-only** (`canDeleteVisitorLog`), enforced in the `DELETE` route, not just hidden in the UI — the log is an ISO record.
- **Check-in first, check-out later.** The public form writes `entered_at` and leaves `exited_at` null; the staff table shows a "ยังอยู่ในพื้นที่" badge and a button that PATCHes `exited_at` + `closed_by`/`closed_at`. Same shape as the downtime log's `ended_at`.
- **One table, `visit_type` discriminates.** `party_size` is always the total headcount *including* the person filling the form: the individual form asks "ผู้ติดตาม N" and stores `N+1`; the group form asks "ทั้งหมด N" and stores `N`. `lib/it-visitor/validation.ts` owns that conversion — don't re-derive it at call sites.
- `it_visitor_form_settings` is a one-row table (`check (singleton)`) holding the public token. Unlike every other table in this module it has **RLS on with no policy at all** plus `revoke all from anon, authenticated` — the token would let anyone post to the public form, so staff only ever see it through a guarded route.
- Public flow copies the satisfaction survey's: signed challenge (750 ms–4 h window), honeypot answering **429** not 400, three rate-limit tiers, 32 KiB body cap measured twice, and an **idempotency check placed before the form-closed gate** so a retry after the form closes still returns the original id. There is deliberately **no device cookie** — the same visitor legitimately returns many times.
- `lib/it-visitor/validation.ts` is pure (types + constants only) and is called from both the browser and the API route, so client and server rules cannot drift.
- `lib/it-visitor/constants.ts` is the single source for every enum + Thai label; its values must match the `CHECK` constraints in the SQL, which the contract test asserts.
- Answering "ไม่สะดวกและไม่ยินยอมศึกษาข้อมูล" to the safety-policy question is **recorded, not blocked** — it raises a red badge and a stat counter for staff to follow up.

### Shared public-form challenge

`lib/security/public-challenge.ts` holds the signed-challenge crypto (HMAC + `timingSafeEqual` + token binding + 750 ms–4 h age window) used by both public forms. `createPublicChallenge(purpose, token)` / `verifyPublicChallenge(purpose, token, challenge)`. The `purpose` string is part of the signed payload, so a challenge minted for one form cannot be replayed against the other. `lib/surveys/public-server.ts` passes `'survey-challenge'` — the exact string it used to hardcode, which keeps signatures byte-identical; **do not change it** or every challenge currently held by someone mid-form breaks. The visitor log uses `'visitor-challenge'`.

### Digital Lab Map (แผนที่ห้องปฏิบัติการ)

Rebuilt from the source floor plan (`Screenshot 2026-07-26 092955.png`) in `lib/lab-map/manifest.ts`. Schema: `scripts/lab-map-module.sql`, then `scripts/lab-map-rebuild-v2.sql`, then `scripts/lab-map-stations-v3.sql` — apply all three manually, in order.

**One coordinate system, one manifest.** `LAB_MAP_VIEW_BOX` is shared by the staff map, the visitor popup, evacuation views, and print. There is no second hand-maintained public geometry manifest — `lib/lab-map/visitor.ts` derives the visitor DTO from the master data and strips `infectionClass`. Do not reintroduce `public-manifest.ts`.

The manifest separates five layers that used to be conflated. Keep them separate:

| Export | What it owns |
|---|---|
| `LAB_STRUCTURES` | Walls, door swings, thresholds, scanner-control barriers. Rendered once, never derived from room rectangles — this is what lets a restroom nest inside the group-head office and a barrier show without inventing a fake room. |
| `LAB_SPACES` | Selectable semantic areas, including nested ones (`nestedIn` + the nested space listed **after** its parent so it draws on top). |
| `LAB_LABELS` | Authored anchors, line breaks, font sizes, rotations. **Labels are never generated by truncating room names** — the old three-line auto-wrap dropped words. |
| `LAB_ACCESS_POINTS` / `LAB_STATIONS` | Checkpoints, the permanently locked **door** (anchored to the door, not to the electrical-control room), exits, map stations. |
| `LAB_ROUTE_PRESETS` | Approved visitor and evacuation polylines. Presets, never shortest-path calculations. |

`lib/lab-map/geometry.ts` is pure (segment intersection, box containment, path parsing) so `validate.ts` and the tests can assert geometry without a browser. `validateLabMapManifest()` enforces, among others: nested spaces are geometrically contained, every space has exactly one authored label, every visitor route starts at its station and **ends exactly at its checkpoint coordinate**, no visitor route properly crosses a `scanner-barrier` or enters a `controlled` space, and every station has both a primary **and** an alternate evacuation preset.

**Visitor checkpoint mapping is explicit and fail-closed** (`VISITOR_CHECKPOINT_BY_DEPARTMENT`), never inferred from the nearest room. The correction that must not regress: **`งานอณูชีววิทยา` → `fingerprint-molecular`**, the checkpoint on the barrier beside the PPE zone below Central Lab — *not* `fingerprint-clinical-immunology`, which is a different room. Departments with no entry get no route and the card tells the visitor to contact the office.

**Exactly one visitor destination is allowed to skip the fingerprint requirement, and it's named explicitly.** `door-meeting-room` (kind `door`, status `open`) has no scanner — confirmed by the user, not assumed — yet visitors can be routed there to meet `GROUP_HEAD_CONTACT_DEPT` (`'หัวหน้ากลุ่มงานเทคนิคการแพทย์'`), the department head. `validate.ts`'s `APPROVED_NON_FINGERPRINT_VISITOR_DESTINATIONS` set is the *only* mechanism that may bypass the "every visitor route ends at a fingerprint-controlled point" rule; it currently holds exactly this one code. Do not add another destination to it without re-confirming with whoever owns physical security — this is a deliberate, narrow, user-approved carve-out, not a general escape hatch. `GROUP_HEAD_CONTACT_DEPT` is declared in `lib/lab-map/visitor.ts` (not `DEPARTMENTS` in `lib/validations/user-schema.ts`) because `DEPARTMENTS` is a real staff-assignment enum used across profiles, equipment, documents, and risk — this destination is a visitor-form-only option, and `lib/it-visitor/constants.ts` re-exports it rather than duplicating the Thai string. The meeting room itself also gained a door in this pass: the original geometry sealed it on all four sides (a defect, not a design choice), and it now has its own `'installation'`-kind evacuation station (`meeting-room`, wired via `checkpointCode: 'door-meeting-room'` so its own preset is used instead of the office's).

The visitor map is reachable from `ActiveVisitCard` as an accessible popup (`components/lab-map/VisitorMapDialog.tsx`): dialog role, Escape, focus trap, focus return, scroll lock. It does not change the URL, so the active visit and its self-checkout button survive. Separately, `/lab-map/[stationCode]` is a public **QR safety companion** for controlled printed signs, not visitor navigation: it exposes only the exterior boundary, the sign's “คุณอยู่ที่นี่” point, approved evacuation routes, exits, and assembly points through `lib/lab-map/public-safety.ts`. It must never serialize rooms, labels, internal doors, infection classes, personnel, or equipment positions. Keep it out of Public Nav and the public home page.

**Production origin:** `https://lab-management-cbh.vercel.app`. Controlled-map QR generation uses `NEXT_PUBLIC_SITE_URL` when configured and falls back to this origin; do not change the fallback or emit QR links for a different domain without an explicit deployment decision.

The map-specific **personnel** mode is gone from `MapMode`, the staff client, the DTO, and the API. `lab_map_person_assignments` is retained in the DB for recoverability and is no longer queried.

**Evacuation plans start from where the person actually is, not always the office.** `LabStationKind` splits `LAB_STATIONS` into `'installation'` (physically mounted placards — office, central-corridor, south-corridor) and `'checkpoint'` (the six fingerprint-scan positions, e.g. `at-molecular`, `at-blood-bank`). A `'checkpoint'` station's coordinates must sit exactly on its `checkpointCode`'s access point (`validate.ts` enforces this with `samePoint`). `stationForCheckpoint(checkpointCode)` resolves a checkpoint code to its safety station, falling back to `'office'` (fail closed) if none exists. `buildVisitorLabMapDTO()` no longer filters stations/routes down to the office — it ships every station and every evacuation preset, and `resolveVisitorDestination()` returns `safetyStationCode` so `ActiveVisitCard` → `VisitorMapDialog` → `LabMapShell` can default the "คุณอยู่ที่นี่" pin and the shown evacuation preset to the visitor's real checkpoint, with a station picker (built on `components/ui/FilterChips`) to switch back to the office. **`'checkpoint'` stations never enter the print catalog** — `/staff/lab-map/print` filters `LAB_STATIONS` to `kind === 'installation'` before building `MapPrintDTO`s, and `buildMapPrintDTO` itself rejects a checkpoint station for any kind except `visitor_navigation`.

`lib/lab-map/safety-assets.ts` holds `LAB_ASSEMBLY_POINTS`, `LAB_SAFETY_EQUIPMENT` (fire extinguishers/hoses/call points), and `EVACUATION_RESTRICTED_SPACE_CODES` (`lift-1`..`lift-4`) — deliberately **separate from `manifest.ts`** so this data can be edited without touching approved geometry. Every `LabSafetyEquipmentDefinition` carries `verified: boolean`; the eleven seeded fire extinguishers were coordinate-transformed from an older wall-mounted evacuation poster (linear mapping from the 3A/3B/3C exit labels common to both drawings) and are **not** confirmed on-site, so they're all `verified: false` with a `sourceNoteTh` describing where to find them. `validatePublishableRelease()` in `release.ts` blocks publishing an official release while any equipment is unverified, and separately while any exit lacks an assembly point (enforced structurally in `validateLabMapManifest()`, not just at publish time).

Sidebar: `ความปลอดภัย` is a group whose **parent carries no `resource`** (same structural rule as the risk and IT groups — `isEntryVisible` checks the parent first), with `แผนที่ห้องปฏิบัติการ` → `/staff/lab-map` as its child.

Releases: rebuilt geometry means a new `LAB_MAP_VERSION` and a new manifest hash, so any release tied to the old hash stops qualifying as an official export (`isOfficialRelease`) and draft printouts keep the watermark. A version may only be published after `docs/lab-map/floor-3-acceptance.md` passes a physical walk-through — automated tests do not replace it.

**Print sheets must render through `LabMapStyles`.** `components/lab-map/LabMapPrintSheet.tsx` wraps its `<LabMapCanvas>` in a `.lab-map-shell` element and renders `<LabMapStyles />` — every design token the canvas draws with (`--map-floor`, `--map-room`, `--map-line`, …) is declared under that class. Drop the wrapper and the tokens resolve to nothing, so SVG `fill`/`stroke` fall back to the browser default (black), rendering solid black rectangles instead of a map — this happened once already; `scripts/lab-map-export-ui.test.ts` asserts the wrapper stays. `LabMapPrintStyles` re-declares the light-mode token values scoped to `.lab-map-shell.lab-map-print-sheet` so a printed sheet always looks like the approved paper document regardless of the viewer's dark-mode setting.

Tests: `scripts/lab-map-domain.test.ts` (geometry invariants + route rules), `scripts/lab-map-visitor-flow.test.ts` (checkpoint table, DTO exclusions, dialog contract), `lib/lab-map/public-safety.test.ts` (QR projection exclusions), `scripts/lab-map-ui.test.ts`, `scripts/lab-map-navigation.test.ts`, `scripts/lab-map-export-ui.test.ts`, `lib/lab-map/{server,print,release}.test.ts`.

### Equipment Map (แผนผังเครื่องมือ)

Phase 1 of PM/CAL walking-tour planning for **ทะเบียนเครื่องมือ** — until this module, the registry had no spatial dimension at all beyond the free-text `department` column, and no due-date computation for PM/CAL.

**This is a different floor plan from the safety map, and the two must stay independent.** The equipment map's geometry is traced from `แผนผังกลุ่มงาน2569.pptx` (the source drawing the lab actually maintains); the safety map (`lib/lab-map`) is drawn from a different survey with different room positions and proportions. An earlier version of this module derived every shape from `LAB_SPACES` on the assumption the two drawings matched — they don't, so every room rendered in the wrong place and the map was unusable. `scripts/equipment-map-domain.test.ts` and `scripts/equipment-map-ui.test.ts` both fail the build if `lib/equipment-map/manifest.ts` imports from `@/lib/lab-map` again. (It still *renders* through `LabMapStyles` for the shared `--map-*` colour tokens — that's styling, not geometry, and is fine.)

**Coordinates come out of the .pptx, not off a screenshot.** A `.pptx` is a zip; `ppt/slides/slide1.xml` holds every shape's exact position in EMU (914400 EMU = 1 inch). The manifest stores those inch values verbatim and converts them once via `rectIn()` / `labelIn()` (`ORIGIN_X_IN` 0.15, `ORIGIN_Y_IN` 1.60, `SCALE` 100 → viewBox `0 0 1380 796`). To change the plan, edit the .pptx and re-extract — never nudge SVG numbers by hand. The 118 red-outlined boxes in the drawing are equipment positions and the 18 `line` shapes are standalone walls (`EQUIPMENT_WALLS`); room edges draw themselves from each area's rect.

`EQUIPMENT_AREAS` (`lib/equipment-map/types.ts` → `EquipmentAreaDefinition`) has two `kind`s — 26 rooms + 13 zones:
- `'room'` — one enclosed room from the drawing. Rooms must never overlap each other (validator enforces).
- `'zone'` — a subdivision of one room. Split rooms: `room-central-lab` → 3 zones (chem-immuno / microscopy / hematology); `zone-special-testing` → 4 zones (upper-1, upper-2, mid, lower — upper was later split in half by direct request, not drawing evidence); `zone-molecular-genomics` → 4 zones (1/2/3/4, rightmost widest — also a direct request, **not** derived from the .pptx, see below); `room-microbiology` → 2 zones (`zone-microbiology-main`, `zone-material-reagent-store`). **Zones must tile their parent exactly** (areas sum equal, no overlaps) — the validator checks this, so a boundary can be moved but a gap can't be left behind.

**Not every zone boundary comes from the drawing — some are direct instructions that override it.** The molecular biology 4-way split and the special-testing upper 2-way split were both requested explicitly ("ไม่ต้องสนต้นฉบับ" / "ให้แบ่งครึ่ง") rather than measured from `.pptx` geometry — don't try to re-derive or "correct" these splits from the source file; they're intentionally not 1:1 with it. Contrast with the nested-rectangle pattern below, which *is* drawing-derived and should be re-checked against the file if questioned.

**Nested-rectangle pattern — check for it before declaring a room "done".** The first geometry pass mapped several rooms to a single bounding rect that actually contains two or three distinct authored shapes stacked underneath it (same `p:style` `lnRef`, `noFill`, genuinely separate `<p:sp>` elements at different sizes — not decoration). That's what the original `room-north-corridor` 3-way split was (before the room count above changed again). When adding a new area from the .pptx, dump every `rect`-scale shape in that region by id/position, not just the one nearest the text label — a bounding-box read that "looks fine" can silently merge two real rooms into one.

**Room/zone identity from the drawing can be wrong even after geometry is verified — confirm meaning, not just shape.** A box whose *position* was measured correctly from the .pptx (`custGeom` id 58 and its mirror gap) turned out to be misidentified: what geometry analysis called "คลังเลือด (ส่วนขยาย)" is actually "คลังน้ำยา" (reagent store) per direct correction, and reagent store itself is not a standalone room — it's a zone of `room-microbiology` (`zone-microbiology-main` + `zone-material-reagent-store`, stacked so the reagent-store zone sits directly below the main zone). `EquipmentRect` only supports axis-aligned boxes, so the L-shaped original is approximated as a plain rectangle (confirmed against no equipment falling in the cut corner). `zone-equipment-wash` is cut short at y=5.60; the two rooms below/right are `room-fume-hood` = **ห้องสารเคมี** and `room-fume-hood-side` = **ไฟฟ้า**. These legacy codes must remain stable so existing `equipment.area_code` links do not break. `room-centre-upper` and `zone-cold-storage` are both widened/narrowed to exactly match `zone-special-testing`'s width per direct instruction, not measured independently. `zone-cold-storage`/`zone-blood-bank` are nudged 0.01 in off raw .pptx values to stop rounding-induced overlaps — all cases commented in the manifest.

**Positions live on `equipment` directly**, not a join table: `area_code`, `map_x`, `map_y`, `position_set_by`, `position_set_at` (`scripts/equipment-map-module.sql`). `equipment_map_point_pair` enforces `map_x`/`map_y` are both null or both set; `area_code` can be set alone (categorized but not yet pinned — this is the "ยังไม่กำหนดตำแหน่ง" list vs. a fully placed pin). Coordinates can only be written through `PATCH /api/admin/equipment/[id]/position`, which validates the point falls inside the target area's actual geometry. The registry may send the camelCase `areaCode` intent with its ordinary POST/PATCH so general fields and a room change commit in one row write; those routes validate it through `resolveEquipmentAreaAssignment`, clear stale coordinates, and still strip raw `area_code`/`map_*`/audit fields from the request body. `scripts/equipment-map-ui.test.ts` asserts this boundary.

**PM/CAL due-state is computed, not stored.** `lib/equipment/pm-cal-due.ts` (`computePmCalDue`) reads the existing `pm_cal_data.plan` (`Record<'Jan'..'Dec', {pm,cal}>`) + `last_pm_date`/`last_cal_date` — fields that already existed but were never compared against "today" anywhere in the app — and derives `'not_required' | 'unplanned' | 'ok' | 'due_soon' | 'overdue'` per equipment, taking the worst ticked month. It interprets `plan` months as the **current calendar year**, not fiscal year (the existing `PmCalModal` UI label says "ปีงบประมาณ" but the data has no year field at all — this predates the equipment map and is left alone; see the function's doc comment for the full reasoning).

**Survey rounds** (`equipment_survey_rounds` + `equipment_survey_records`) give the "สำรวจแล้ว/ยังไม่สำรวจ" checkbox a reset boundary: opening a new round makes every pin default to unsurveyed (there's simply no record for it yet in the new round), and a partial unique index (`(closed_at is null)`) guarantees at most one open round at a time. `POST /api/admin/equipment/[id]/survey` 409s if no round is open.

**Two independent visual channels on each pin**, deliberately not conflated (`components/equipment-map/EquipmentMapCanvas.tsx`): the outer ring color is the survey state (green = surveyed this round, red = not, gray = no round open); the glyph inside is the condition/due state (`✕` ชำรุด, `?` รอขึ้นทะเบียน, `!` เกินกำหนด, `◐` ใกล้ครบกำหนด, `✓` ปกติและสำรวจแล้ว). Same "never color alone" rule as the risk module.

**A new canvas, not a reused `LabMapCanvas`.** `LabMapCanvas`/`MapMode` are governed by the safety map's release/print pipeline and shared by `RiskMapClient`; adding an equipment-pin mode there would touch print DTOs and four hard-coded legend blocks for no shared benefit. `EquipmentMapCanvas.tsx` is a small (~250-line) sibling that still wraps in `.lab-map-shell` and renders `<LabMapStyles />` (**required** — see the lab-map section above; skip it and the SVG renders solid black) plus a local `<EquipmentMapStyles />` for pin/panel-specific rules. It parses its own `viewBox` for coordinate-picker clamping rather than hardcoding `1477`/`892` like the original `LabMapCanvas` once did. Rooms paint before zones so subdivisions sit on top, and a room that has zones renders as an outline only (`[data-split-room]`) instead of filling over its own children.

**Assigning an area and pinning a coordinate are separate steps, and both count.** `area_code` can be set while `map_x`/`map_y` stay null — that means "we know which room it's in, we haven't walked over and dropped the pin yet". `EquipmentPinDTO.placed` distinguishes them. The canvas draws only placed pins (an unplaced one has no coordinate to draw at), but **area lists and counts include both**, with a "ยังไม่ปักหมุด" badge on the unplaced ones. Filtering the list down to placed pins is what made a freshly-assigned instrument look like it had vanished from the map.

**PM/CAL work groups are operational taxonomy, not geometry.** `สำนักงานกลุ่มงานฯ` explicitly contains `zone-equipment-wash` (ห้องล้าง), `room-fume-hood` (ห้องสารเคมี), `zone-cold-storage` (ตู้เย็น), and `zone-material-reagent-store` (คลังน้ำยา). The last area remains a geometric child of `room-microbiology`; grouping it under the office must not change `parentCode` or its shape.

Sidebar: the equipment group's two children (`ทะเบียนเครื่องมือ` → `/staff/equipment`, `แผนผังเครื่องมือ` → `/staff/equipment/map`) both carry the **same** `resource: 'ทะเบียนเครื่องมือ'` — unlike the risk/IT/safety groups, this isn't a case of differing per-child permissions, but the "parent carries no resource" structure is kept identical anyway so `isEntryVisible` behaves the same way everywhere in this file.

Filtering: `?area=` on `/staff/equipment` filters by room **or zone** code; picking a room includes its child zones' equipment too (`areaAndDescendantCodes()` in the manifest, reused by both `lib/queries/equipment.ts` and the API route's `applyEquipmentFilters`). `?unpositioned=1` shows equipment with no `area_code` or no pinned coordinates yet. `?open=<id>&panel=pmcal` (used by the map's "ดู PM/CAL" link) opens `PmCalModal` directly via a small `GET /api/admin/equipment/[id]` added for this purpose.

Excel round-trip: exports carry both the stable `Area Code` and the current `ห้อง/โซน` display name. Import resolves the stable code first, supports a unique display name for older exports, rejects ambiguous/unknown areas, clears old coordinates when an updated row changes area, and always lets a recognized LAB code determine department/classification (including `MT` for `สำนักงานกลุ่มงานเทคนิคการแพทย์`).

Schema: run in order — `scripts/equipment-map-module.sql` (tables + position columns + survey rounds), `equipment-map-areas-v2.sql` (replaces the v1 area seed that was derived from the safety map), `equipment-map-areas-v3.sql` (nested-rectangle corrections), `equipment-map-areas-v4.sql` (identity correction folding reagent store into microbiology, plus the direct-instruction zone splits). Each area-seed script deletes only `has_geometry = true` rows so user-created off-plan areas survive, keeps the area codes whose meaning carried over so existing `equipment.area_code` links aren't broken, and never overwrites `name_th` (areas are renameable from the UI). Expect more small v*.sql corrections as the drawing gets re-checked room by room — that's normal for this module, not a sign something is broken.

Tests: `scripts/equipment-map-domain.test.ts` (validator clean, zone tiling for all split rooms including the 4-way molecular and special-testing splits, drawing labels present, viewBox hugs the plan, no lab-map import), `lib/equipment/pm-cal-due.test.ts` (due-state cases), `scripts/equipment-map-ui.test.ts` (canvas token wrapper, position-field lockdown, sidebar resource placement, no hardcoded hex in the non-canvas components).

### Chemical Safety (ห้องเก็บสารเคมี + SDS)

Schema: `scripts/chemical-safety-module.sql`, then `scripts/chemical-safety-ghs-and-departments.sql`. Apply both manually, in order.

**There are two SDS worlds and they must never be merged.** Conflating them is the single easiest way to wreck this module:

| | ทะเบียนสารเคมีห้องเก็บสารเคมี | คลังเอกสาร SDS แยกตามงาน |
|---|---|---|
| What | 25 pure chemicals from the Unit Chemical Inventory List | ~500 SDS PDFs for commercial reagents/kits, 10 departments |
| Tables | `chemical_products` + holdings + `chemical_sds_versions` | `chemical_sds_departments` + `chemical_department_sds` |
| Has | storage position, stock quantity, GHS classification, per-document review workflow | filename-derived display name only |
| Published by | approving one SDS version at a time (`review_chemical_sds_version`) | หัวหน้างาน publishing the whole department at once |

The reagent SDS are not inventory items — putting them in `chemical_products` would bury the 25 real chemicals under hundreds of reagent files.

**Access is currently Admin-only for the whole staff side.** `chemicalAccessDecision` in `lib/chemical-safety/access.ts` ignores its `scopes`/`request` arguments and returns `role === 'Admin'` — a deliberate lockdown (commit `96d2e70`), asserted by `chemical-safety-schema.test.ts`. `chemical_role_scopes` and the custodian/reviewer split still exist and the SDS workflow routes are written against them, so restoring scoped access is a one-function change — but do it deliberately, not as a side effect.

**The public side is deliberately open.** `/sds`, `/api/public/sds/*` and `/api/public/department-sds/*` have **no guard** — only rate limits. Everything they expose is filtered inside `lib/chemical-safety/public.ts`. The lockdown above had also closed these (the page called `requireChemicalAdmin()` and 404'd anonymous visitors); that was reversed on the public side only. `chemical-safety-ui.test.ts` fails if a guard is reintroduced there.

GHS classification has **two sources with a fixed precedence**:
- `lib/chemical-safety/ghs.ts` parses the Thai hazard text from the master list into GHS01–09. It matches whole known phrases rather than splitting on `และ`/`,` (the source punctuation is inconsistent) and repairs the PDF-extraction damage that is actually present (`พิษต ่า`→`พิษต่ำ`, `ความ เป็นอันตราย` line-wrap, …). Unrecognized text goes into `unmatched`; `parseThaiGhsTextOrThrow` makes the materializer **fail loudly** rather than silently drop a classification.
- Stored on `chemical_products.ghs_*` by the materializer. **An approved `chemical_sds_versions` row always wins**; the master-list values are the fallback. Both the registry and the public page carry a `ghsSource` field so the UI can say where the symbols came from — never present master-list-derived symbols as if they came from the SDS document.
- `ของแข็งไม่กำหนดประเภท` classifies to **no pictogram**. Render it as text, never as an empty cell, or it becomes indistinguishable from "never classified".

**Storage positions come from the layout drawing, not the master list.** The master list writes `"B3, B4"` for 6 chemicals; the ผังการจัดเก็บ image (ฉบับ 2 กุมภาพันธ์ 2569) assigns each to a single cabinet. `INITIAL_POSITION_ASSIGNMENTS` follows the drawing. `CHEMICAL_ZONE_META` / `CHEMICAL_GROUP_SUMMARY` / `CHEMICAL_LAYOUT_UPDATED_LABEL` in `storage-manifest.ts` carry the rest of the drawing (zone titles, the segregation-rationale table, revision date).

Department mapping is **explicit and fail-closed** (`DEPARTMENT_BY_ARCHIVE_FOLDER` in `lib/chemical-safety/departments.ts`). Three archive folders do not match `DEPARTMENTS`: `งานจุลทรรศนศาสตร์`→`…คลินิก`, `งานภูมิคุ้มกันวิทยา`→`…คลินิก`, `ศูนย์สุขภาพชุมชนเมืองชลบุรี`→`ห้องปฏิบัติการ…`. `ห้องสารเคมี` maps to nothing **on purpose** — it goes through the product model.

Other things that bite:
- `update_chemical_sds_draft` only lets `created_by`/`submitted_by` edit a draft, but materialized drafts have both null. `claimOrphanDraft` in `sds-workflow.ts` assigns ownership to the first custodian who edits — without it those drafts are permanently uneditable. It must not touch `updated_at` or it breaks the caller's optimistic lock.
- `parseJson` infers `output<S>`, not `ZodType<T>`. Inferring from `ZodType<T>` picks zod's *input* type, which makes `.default()` fields optional and `z.preprocess` fields `unknown`.
- SQL and zod must agree on H/P code shapes. They didn't: SQL demanded `^P[0-9]{3}$` while zod accepted `P301+P310`, so any real combination P-statement failed on insert. Fixed in the GHS migration — keep them in step.
- `components/chemical-safety/shared/tokens.ts` is the only place meaning→visual is mapped. `chemical-safety-ui.test.ts` fails the build if a component hardcodes a hex colour, re-declares the zone colour map, or drops a `components/ui/` import — the module previously used none of the house components and broke dark mode entirely.

Backfill: `npx tsx scripts/backfill-department-sds.ts` (dry-run; `--apply` to write) reads `chemical_sds_files.source_paths` already in the DB. The importer uploaded every archive PDF to R2 long ago — this script only creates the department links, and never touches R2.

Tests: `npm run test:chemical-safety` runs schema, domain, GHS parsing, department mapping, materialization, master-list, SDS import, CLI, runtime, and UI contracts.

## Module Reference

| Module | Resource Key (lib/permission-resources.ts) | Staff Route | API Routes |
|--------|---------------------------------------------|-------------|------------|
| Test Catalog | `รายการตรวจ` | `/staff/tests/*` | `/api/admin/tests/` |
| Categories | `รายการตรวจ` (Admin only) | `/staff/tests/categories` | `/api/admin/categories` |
| Documents | `เอกสารคุณภาพ` | `/staff/documents`, `/staff/documents/dashboard`, `/staff/documents/categories`, `/staff/documents/pending`, `/staff/documents/read-report` | `/api/admin/documents/`, `/api/admin/documents/[id]/`, `/api/admin/documents/[id]/revisions/`, `/api/admin/documents/[id]/read`, `/api/admin/documents/[id]/confirm-review`, `/api/admin/documents/bulk-annual-review`, `/api/admin/documents/bulk-read-audience`, `/api/admin/documents/purge-deleted` |
| Master List | `Master List` | `/staff/documents/master-list` | — |
| News | `ข่าวสาร` | `/staff/news` | — |
| Rejection Log | `ความเสี่ยง / Rejection` | `/staff/rejection?view=<report-view-id>` | — |
| Risk Management | `ความเสี่ยง / Rejection` | `/staff/risk`, `/staff/risk/ior`, `/staff/risk/register`, `/staff/risk/smart-rm`; `/staff/risk/report` is open to **any signed-in user** | `/api/admin/risk/{incidents,register,smart-rm,overview,attachments,export}` |
| EQA / PT | `EQA / PT` (editor list overrides to edit) | `/staff/eqa`, `/staff/eqa/programs`, `/staff/eqa/rounds`, `/staff/eqa/coverage`, `/staff/eqa/capa`, Admin `/staff/eqa/settings` | `/api/admin/eqa/*` |
| OUTLAB | `OUTLAB` (editor list overrides to edit) | `/staff/outlab`, `/staff/outlab/laboratories`, `/staff/outlab/services`, `/staff/outlab/certificates`, Admin `/staff/outlab/settings` | `/api/admin/outlab/*` |
| Contracts | `สัญญา` | `/staff/contracts` | — |
| KPI | `KPI` | `/kpi/dashboard?view=dashboard\|annual\|compare\|satisfaction` | — |
| Lab Workload | `Workload` | `/lab-workload/dashboard?section=<overview-or-department-id>` | — |
| TAT | `TAT` | `/tat/dashboard?view=overview\|phlebotomy\|lab` | — |
| Users & Roles | `User Management` | `/staff/admin` | `/api/admin/users/`, `/api/admin/permissions` |
| Quality Tasks | `งานคุณภาพ` | `/staff/quality-tasks/*` | `/api/admin/quality-tasks/*` |
| Satisfaction Surveys | `แบบสำรวจความพึงพอใจ` | `/staff/satisfaction`, `/staff/satisfaction/surveys`, `/staff/satisfaction/campaigns`, `/staff/satisfaction/comments`, public `/s/[token]` | `/api/admin/satisfaction/*`, public `/api/satisfaction/[token]` |
| งาน IT | `ระบบสารสนเทศ (IT)` | `/staff/it/access`, `/staff/it/downtime`, `/staff/it/backup` | `/api/admin/it-access/*`, `/api/admin/it-downtime/*`, `/api/admin/it-backup/*` |
| บันทึกการเข้า-ออก | `บันทึกการเข้า-ออก` (ทุก role ยกเว้น Assistant; ลบได้เฉพาะ Admin) | `/staff/it/visitors`, public `/v/[token]` | `/api/admin/it-visitors/*`, public `/api/it-visitors/[token]` |
| ความปลอดภัย → แผนที่ห้องปฏิบัติการ | — (ทุกคนที่ล็อกอิน; ไม่มี resource gate) | `/staff/lab-map`, `/staff/lab-map/print`; visitor popup inside `/v/[token]` | `/api/admin/lab-map/releases/*` |
| ความปลอดภัย → ห้องสารเคมี / SDS | — (ไม่ใช้ permission matrix; `chemicalAccessDecision` = Admin เท่านั้น) | `/staff/lab-map/chemicals?view=overview\|layout\|registry\|imports`, `/staff/lab-map/sds?view=chemicals\|departments`; public `/sds` (ไม่ต้องล็อกอิน) | `/api/admin/chemical-safety/*`, public `/api/public/sds/*`, `/api/public/department-sds/*`, `/api/public/safety-manual/MN-LAB-02` |
