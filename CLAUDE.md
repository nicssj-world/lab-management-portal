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

There are no lint or test scripts. Type-check is the only automated verification.

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
`Button`, `Card`, `Icon`, `Input`, `Select`, `Badge`, `PageHeader`, `Stat`, `EmptyState`, `MonthSelector`

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

**Upload controls** — every file upload UI must support Drag & Drop in addition to click-to-browse. Use a visible drop zone with `dragover` feedback using `var(--primary-soft)`, keep keyboard-accessible file input/button behavior, and apply this consistently across documents, personnel evidence, imports, images, and any future upload feature.

**Pill tabs (type filter)** — outlined, active = gray fill:
```tsx
<button style={{
  padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)',
  background: active ? 'var(--surface-2)' : 'transparent',
  color: active ? 'var(--ink)' : 'var(--muted)',
  fontWeight: active ? 700 : 500, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
}}>
  {label} <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{count}</span>
</button>
```

**Filled pills (visibility / status filter)** — active = primary fill:
```tsx
<button style={{
  padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--ink)',
  fontWeight: 600, fontSize: 12.5,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
}}>
  {label}
</button>
```

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

`components/layout/StaffTopbar.tsx` maps exact pathnames to Thai/English titles via `PAGE_TITLES`. Add an entry for every new staff route — the topbar will show an empty string otherwise.

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
| `documents` | Main records. Has `deleted_at`, `obsolete_date`, `obsolete_reason`, `reviewer_name`, `approver_name` |
| `document_revisions` | Version history. Has `approved_by`, `revised_by`, `revision_note`, `file_url`, `file_name` |
| `document_access_logs` | Audit log. Actions: `upload`, `download`, `edit`, `delete` |

Auto-revision: PATCH handler always fetches current doc; if revision number changes OR a new file is uploaded, the old state is saved to `document_revisions` before updating.

Status workflow: `Draft → Review → Approved → Published → Obsolete`. Transitioning to Obsolete auto-sets `obsolete_date`; leaving Obsolete clears both `obsolete_date` and `obsolete_reason`.

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

## Module Reference

| Module | Resource Key (lib/permission-resources.ts) | Staff Route | API Routes |
|--------|---------------------------------------------|-------------|------------|
| Test Catalog | `รายการตรวจ` | `/staff/tests/*` | `/api/admin/tests/` |
| Categories | `รายการตรวจ` (Admin only) | `/staff/tests/categories` | `/api/admin/categories` |
| Documents | `เอกสารคุณภาพ` | `/staff/documents` | `/api/admin/documents/`, `/api/admin/documents/[id]/`, `/api/admin/documents/[id]/revisions/`, `/api/admin/documents/[id]/read`, `/api/admin/documents/purge-deleted` |
| Master List | `Master List` | `/staff/documents/master-list` | — |
| News | `ข่าวสาร` | `/staff/news` | — |
| Rejection Log | `ความเสี่ยง / Rejection` | `/staff/rejection` | — |
| Risk Register | `ความเสี่ยง / Rejection` | `/staff/risk` | — |
| Contracts | `สัญญา` | `/staff/contracts` | — |
| KPI | `KPI` | `/kpi/*` | — |
| Lab Workload | `Workload` | `/lab-workload/*` | — |
| TAT | `TAT` | `/tat/*` | — |
| Users & Roles | `User Management` | `/staff/admin` | `/api/admin/users/`, `/api/admin/permissions` |
