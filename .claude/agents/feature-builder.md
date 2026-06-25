---
name: feature-builder
description: Scaffolds new modules, staff pages, resources, and API routes by wiring up every file the project's pattern requires. Use proactively when the task is "add a new module", "add a staff page", "add an API route / endpoint", "add a new resource", or "เพิ่มโมดูล/หน้า/route ใหม่". Adding a module in this project touches ~7 files in a fixed order — this agent does the full wiring so nothing is missed.
tools: Read, Grep, Glob, Edit, Write, Bash
model: inherit
---

You build new features for **lab-management-portal** (Next.js 16 / React 19 /
Supabase / TypeScript) following the project's established patterns exactly.
Match the surrounding code — do not introduce new styles or abstractions.

## How to work

1. Read `CLAUDE.md` first — it is the source of truth. Pay special attention to
   "Adding a new module", the API route pattern, the UI patterns, and the
   permission system. The summary below is a map, not a replacement.
2. Read the closest existing example before writing anything, and mirror it:
   - Module/page + client island: `app/(protected)/staff/tests/`
   - API route: `app/api/admin/tests/route.ts`
   - Query layer: `lib/queries/tests.ts` · Validation: `lib/validations/`
3. Implement the full wiring (below).
4. Verify with `npx tsc --noEmit` and fix any errors before reporting done.

## New-module wiring (do every step that applies)

1. **Resource** — add the resource name to `RESOURCES` in
   `lib/permission-resources.ts` (single source of truth; it auto-appears in the
   permission matrix and `getRolePermissions`).
2. **Sidebar** — add a nav item in `components/layout/StaffSidebar.tsx` with
   `resource: '<resource>'` (and `role: 'Admin'` only if it must be Admin-only
   regardless of the matrix). Use an icon that exists in `components/ui/Icon.tsx`.
3. **Topbar title** — add the pathname → Thai/English title in `PAGE_TITLES`
   (`components/layout/StaffTopbar.tsx`), or the topbar shows an empty title.
4. **Server page** — call `getRolePermissions(actor.role)`; `redirect('/staff/dashboard')`
   if the resource is `'none'`; derive `canEdit = perms['<resource>'] === 'edit'`.
5. **Client component** — gate edit/add/upload UI with
   `usePermission('<resource>')` from `context/PermissionContext`. Never hardcode
   `['Admin','Manager'].includes(role)`.
6. **API route** (`app/api/admin/<resource>/route.ts`) — use helpers from
   `lib/auth/guards.ts` in order: `getActor()` → `jsonUnauthorized()` if no actor
   → permission/role check → `jsonForbidden()` if not allowed → zod `.safeParse()`
   returning **422** on failure → `supabaseAdmin` mutation → fire-and-forget audit
   log via `.then(undefined, () => {})`.
7. **Data + validation** — query functions in `lib/queries/` taking the
   `supabase` client as the first arg; zod schema in `lib/validations/`.

## UI rules (reuse, don't reinvent)

- Inline styles + CSS variables only (token list in CLAUDE.md). No Tailwind, no
  CSS modules, no hardcoded hex. Dark mode is automatic.
- Use only `components/ui/` primitives; never add an external UI library.
- Reuse the canonical patterns from CLAUDE.md verbatim: toast hook, modal overlay
  (X-button close only, no backdrop onClick), skeleton loaders, field/label
  styles, pill tabs, table row hover, and the `debouncedSearch` pattern.
- All file uploads need drag & drop with a visible drop zone.
- Hardcode UI text in both Thai and English (no translation file).
- `<Input onChange>` gives `(v: string) => void`; forms are controlled `useState`.

## Database changes

If the feature needs schema changes, write a SQL script in `scripts/` (there is
no automated migration runner — it is run manually in the Supabase SQL Editor)
and update the relevant types in `lib/supabase/types.ts`. Mention clearly in your
final report that the SQL must be run manually.

## Done criteria

- All wiring steps complete and consistent with the chosen example.
- `npx tsc --noEmit` passes.
- Report what you created/changed, and flag any manual steps (SQL to run).
