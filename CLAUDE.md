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

### Documents Module DB Tables

| Table | Purpose |
|-------|---------|
| `documents` | Main records. Has `deleted_at`, `obsolete_date`, `obsolete_reason`, `reviewer_name`, `approver_name` |
| `document_revisions` | Version history. Has `approved_by`, `revised_by`, `revision_note`, `file_url`, `file_name` |
| `document_access_logs` | Audit log. Actions: `upload`, `download`, `edit`, `delete` |

Auto-revision: PATCH handler always fetches current doc; if revision number changes OR a new file is uploaded, the old state is saved to `document_revisions` before updating.

Status workflow: `Draft → Review → Approved → Published → Obsolete`. Transitioning to Obsolete auto-sets `obsolete_date`; leaving Obsolete clears both `obsolete_date` and `obsolete_reason`.

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
