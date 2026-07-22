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
