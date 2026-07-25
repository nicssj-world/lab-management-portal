# Digital Lab Map Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the versioned floor-map domain, interactive SVG renderer, safe public map, and protected staff map shell without database-backed personnel integration.

**Architecture:** Render a typed geometry manifest into one responsive inline SVG. Keep a separate coarse public manifest so the public client never receives internal room topology; protected pages receive the full manifest. Pages remain Server Components and pass serializable DTOs into small interactive Client Components.

**Tech Stack:** Next.js 16.2 App Router, React 19.2, TypeScript 5, existing UI primitives, Node `assert` + `tsx` contract tests.

## Global Constraints

- Source design: `docs/superpowers/specs/2026-07-26-digital-lab-map-design.md`.
- Read relevant installed Next.js guidance under `node_modules/next/dist/docs/` before changing routes, Route Handlers, cookies, or Server/Client boundaries.
- Full map reference geometry: `C:\Users\User\OneDrive\Pictures\Screenshots 1\Screenshot 2026-07-26 015253.png` with a 1487×893 coordinate system.
- Infection-control reference: `C:\Users\User\OneDrive\Pictures\Screenshots 1\Screenshot 2026-07-26 020049.png`.
- Public clients must not receive internal BSL2/PCR topology, internal doors, personnel, or infection-control classifications.
- A visitor route must end at a fingerprint checkpoint. No route may include the permanently locked electrical-control-room door.
- Map controls need 44 px targets, visible focus, non-color labels/patterns, keyboard operation, reduced-motion support, and mobile bottom-sheet behavior.
- Do not add a drag-and-drop geometry editor or shortest-path evacuation generator.

---

### Task 1: Define the typed map domain and integrity validator

**Files:**
- Create: `lib/lab-map/types.ts`
- Create: `lib/lab-map/manifest.ts`
- Create: `lib/lab-map/public-manifest.ts`
- Create: `lib/lab-map/validate.ts`
- Create: `scripts/lab-map-domain.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `LAB_MAP_VERSION`, `LAB_SPACES`, `LAB_ZONES`, `LAB_ACCESS_POINTS`, `LAB_STATIONS`, `LAB_ROUTE_PRESETS`.
- Produces: `PUBLIC_LAB_SPACES`, `PUBLIC_LAB_ROUTES` containing coarse public-only geometry.
- Produces: `validateLabMapManifest(): string[]` and `resolveRoutePreset(input): LabRoutePreset | null`.
- Consumes: canonical department strings from `lib/validations/user-schema.ts`.

- [ ] **Step 1: Write the failing domain test**

Create `scripts/lab-map-domain.test.ts` with executable assertions:

```ts
import assert from 'node:assert/strict'
import {
  LAB_ACCESS_POINTS, LAB_ROUTE_PRESETS, LAB_SPACES, LAB_STATIONS, LAB_ZONES,
} from '../lib/lab-map/manifest'
import { PUBLIC_LAB_SPACES } from '../lib/lab-map/public-manifest'
import { validateLabMapManifest } from '../lib/lab-map/validate'

assert.deepEqual(validateLabMapManifest(), [])
assert.equal(new Set(LAB_SPACES.map((space) => space.code)).size, LAB_SPACES.length)
assert.equal(LAB_ACCESS_POINTS.find((point) => point.code === 'door-electrical-control')?.status, 'permanently_locked')
assert.ok(LAB_ZONES.find((zone) => zone.code === 'storage-zone')?.spaceCodes.includes('cold-material-reagent-store'))
assert.ok(LAB_ZONES.find((zone) => zone.code === 'storage-zone')?.spaceCodes.includes('material-store'))
assert.ok(LAB_ZONES.find((zone) => zone.code === 'storage-zone')?.spaceCodes.includes('material-reagent-store'))
assert.ok(LAB_ROUTE_PRESETS.every((route) => !route.pointCodes.includes('door-electrical-control')))
assert.ok(LAB_STATIONS.every((station) => LAB_ROUTE_PRESETS.some((route) => route.kind === 'evacuation' && route.fromStationCode === station.code)))
assert.ok(!JSON.stringify(PUBLIC_LAB_SPACES).match(/BSL2|PCR|infectious|permanently_locked/i))

console.log('lab map domain tests passed')
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx tsx scripts/lab-map-domain.test.ts`

Expected: FAIL with `Cannot find module '../lib/lab-map/manifest'`.

- [ ] **Step 3: Add the core types**

Create `lib/lab-map/types.ts` with these exact public interfaces:

```ts
export type InfectionClass = 'infectious' | 'clean' | 'risk'
export type AccessPointStatus = 'open' | 'fingerprint_controlled' | 'permanently_locked'
export type MapMode = 'overview' | 'infection' | 'safety' | 'personnel'
export type RouteKind = 'visitor' | 'staff_orientation' | 'evacuation'

export type SvgShape =
  | { type: 'rect'; x: number; y: number; width: number; height: number; rx?: number }
  | { type: 'polygon'; points: ReadonlyArray<readonly [number, number]> }
  | { type: 'path'; d: string }

export interface LabSpaceDefinition {
  code: string
  nameTh: string
  nameEn?: string
  shape: SvgShape
  infectionClass: InfectionClass
  workUnits: readonly string[]
  controlled: boolean
}

export interface LabZoneDefinition {
  code: string
  nameTh: string
  spaceCodes: readonly string[]
  workUnits: readonly string[]
}

export interface LabAccessPointDefinition {
  code: string
  nameTh: string
  kind: 'fingerprint' | 'door' | 'exit'
  status: AccessPointStatus
  x: number
  y: number
}

export interface LabStationDefinition {
  code: string
  nameTh: string
  x: number
  y: number
}

export interface LabRoutePreset {
  code: string
  kind: RouteKind
  fromStationCode: string
  destinationCode: string
  pointCodes: readonly string[]
  polyline: ReadonlyArray<readonly [number, number]>
  directionsTh: readonly string[]
}

export interface LabMapSpaceDTO extends Omit<LabSpaceDefinition, 'infectionClass'> {
  infectionClass?: InfectionClass
}

export interface LabMapDTO {
  version: string
  viewBox: string
  stationCode: string
  spaces: readonly LabMapSpaceDTO[]
  zones: readonly LabZoneDefinition[]
  accessPoints: readonly LabAccessPointDefinition[]
  routes: readonly LabRoutePreset[]
}
```

- [ ] **Step 4: Trace and add the full/private and coarse/public manifests**

Create `lib/lab-map/manifest.ts` with `LAB_MAP_VERSION = 'F3-2026.07.26-01'`, `viewBox = '0 0 1487 893'`, and complete geometry traced from the approved 015253 image. Use stable English codes and include at least these required mappings:

```ts
export const REQUIRED_SPACE_CODES = [
  'office', 'group-head-office', 'meeting-room',
  'central-lab-left', 'central-lab-right', 'clinical-immunology-room',
  'molecular-biology-lab', 'genomics-lab',
  'microbiology-lab', 'infectious-diagnosis-room', 'bsl2-enhance', 'pcr-room',
  'culture-media-prep', 'specimen-prep',
  'material-store', 'material-reagent-store', 'cold-material-reagent-store',
  'special-testing-lab', 'blood-donation-room', 'blood-component-room', 'blood-prep-room',
  'ppe-zone', 'equipment-wash', 'chemical-prep', 'electrical-control', 'computer-control',
] as const
```

The manifest must map Central Lab left to clinical chemistry + clinical immunology, Central Lab right to hematology + clinical microscopy, and BSL2/PCR to microbiology. Define `storage-zone` with the three approved storage spaces. Define the electrical-control door with `status: 'permanently_locked'` and omit it from every route.

Create `lib/lab-map/public-manifest.ts` independently. It may contain office/common corridors, exits, fingerprint checkpoints, Central Lab left/right destination blocks, and coarse work-unit blocks. It must not import `LAB_SPACES`; this prevents a future refactor from serializing private topology accidentally.

- [ ] **Step 5: Implement validation and preset resolution**

Create `lib/lab-map/validate.ts` that returns concrete errors for duplicate codes, missing zone members, missing route points/stations, routes through permanently locked doors, visitor routes not ending at fingerprint points, and published stations without evacuation presets. Export:

```ts
export function validateLabMapManifest(): string[]

export function resolveRoutePreset(input: {
  kind: RouteKind
  stationCode: string
  destinationCode: string
}): LabRoutePreset | null
```

`resolveRoutePreset` must use exact preset lookup only and return `null` rather than calculate a fallback route.

- [ ] **Step 6: Add and run the focused script**

Add `"test:lab-map": "tsx scripts/lab-map-domain.test.ts"` to `package.json`.

Run: `npm run test:lab-map`

Expected: `lab map domain tests passed`.

- [ ] **Step 7: Commit the domain foundation**

```bash
git add lib/lab-map scripts/lab-map-domain.test.ts package.json
git commit -m "feat(lab-map): add typed floor map manifest"
```

---

### Task 2: Build the accessible reusable SVG map renderer

**Files:**
- Create: `components/lab-map/LabMapCanvas.tsx`
- Create: `components/lab-map/LabMapShell.tsx`
- Create: `components/lab-map/LabMapStyles.tsx`
- Create: `scripts/lab-map-ui.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `LabMapDTO`, `MapMode`, and manifest shapes from Task 1.
- Produces: `LabMapCanvas`, a controlled Client Component with `selectedCode`, `onSelect`, `activeRouteCode`, and `mode` props.
- Produces: `LabMapShell`, which owns tabs, search, selection, zoom/reset, and mobile detail-sheet state.

- [ ] **Step 1: Write the renderer contract test**

Create `scripts/lab-map-ui.test.ts` and assert that the renderer contains an `<svg>`, semantic selectable controls, `data-space-code`, `aria-label`, keyboard handlers, infection patterns, `prefers-reduced-motion`, 44 px controls, reset-view behavior, and no import from `manifest.ts` inside the generic canvas.

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx tsx scripts/lab-map-ui.test.ts`

Expected: FAIL because `components/lab-map/LabMapCanvas.tsx` does not exist.

- [ ] **Step 3: Implement the SVG renderer as a narrow Client Component**

Create `components/lab-map/LabMapCanvas.tsx` with this exact public boundary:

```tsx
'use client'

import type { LabMapDTO, MapMode, SvgShape } from '@/lib/lab-map/types'

export interface LabMapCanvasProps {
  map: LabMapDTO
  mode: MapMode
  selectedCode: string | null
  activeRouteCode: string | null
  onSelect: (code: string) => void
}
```

Implement and export `LabMapCanvas(props: LabMapCanvasProps)`. It renders one inline `<svg viewBox="0 0 1487 893">`, converts every `SvgShape` variant through an exhaustive switch, renders route polylines, and exposes each selectable space as a focusable `role="button"` group. Use SVG `<pattern>` definitions for infectious/risk modes, text/icon labels in addition to color, and `onKeyDown` for Enter/Space. Keep zoom/pan state in this component and provide an explicit reset callback; do not use geolocation.

- [ ] **Step 4: Implement the shell and scoped styles**

`LabMapShell` accepts `{ map, allowedModes, initialMode, detail }`, renders view buttons with `aria-pressed`, a search input, the canvas, and a side panel that becomes a bottom sheet below 768 px. `LabMapStyles` returns the shared `<style>` block so public, staff, and print pages do not duplicate CSS.

- [ ] **Step 5: Run focused UI and domain tests**

Run each command separately:

```bash
npx tsx scripts/lab-map-ui.test.ts
npm run test:lab-map
```

Expected: both scripts print their `passed` messages.

- [ ] **Step 6: Commit the renderer**

```bash
git add components/lab-map scripts/lab-map-ui.test.ts package.json
git commit -m "feat(lab-map): add accessible SVG renderer"
```

---

### Task 3: Add the coarse public map route and homepage entry point

**Files:**
- Create: `app/(public)/lab-map/[stationCode]/page.tsx`
- Create: `lib/lab-map/public.ts`
- Create: `scripts/lab-map-public.test.ts`
- Modify: `app/(public)/page.tsx`
- Modify: `components/layout/PublicNav.tsx`
- Modify: `package.json`

**Interfaces:**
- Consumes: public-only constants from `public-manifest.ts`.
- Produces: `getPublicLabMapDTO(stationCode: string): LabMapDTO | null`.
- Produces: public route `/lab-map/office` and station-specific QR routes.

- [ ] **Step 1: Write the failing public-projection test**

Assert that the public helper imports only `public-manifest`, rejects unknown station codes, the page awaits `params`, the serialized DTO lacks internal names/classifications, and the home page links to `/lab-map/office` without embedding the full map.

- [ ] **Step 2: Verify the test fails**

Run: `npx tsx scripts/lab-map-public.test.ts`

Expected: FAIL because the public page/helper do not exist.

- [ ] **Step 3: Implement a minimal public DTO helper**

Create `lib/lab-map/public.ts` with no Supabase import and no private-manifest import:

```ts
import {
  PUBLIC_LAB_ACCESS_POINTS, PUBLIC_LAB_ROUTES, PUBLIC_LAB_SPACES,
  PUBLIC_LAB_STATIONS, PUBLIC_LAB_VIEW_BOX, PUBLIC_LAB_ZONES,
} from './public-manifest'
import type { LabMapDTO } from './types'

export function getPublicLabMapDTO(stationCode: string): LabMapDTO | null {
  if (!PUBLIC_LAB_STATIONS.some((station) => station.code === stationCode)) return null
  return {
    version: 'F3-2026.07.26-01-public',
    viewBox: PUBLIC_LAB_VIEW_BOX,
    stationCode,
    spaces: PUBLIC_LAB_SPACES,
    zones: PUBLIC_LAB_ZONES,
    accessPoints: PUBLIC_LAB_ACCESS_POINTS,
    routes: PUBLIC_LAB_ROUTES.filter((route) => route.fromStationCode === stationCode),
  }
}
```

- [ ] **Step 4: Implement the dynamic public page**

Use `PageProps<'/lab-map/[stationCode]'>`, await `props.params`, call the public helper, and use `notFound()` for an unknown station. Export descriptive metadata. Pass only the returned DTO to `LabMapShell` with overview/safety modes and public-safe Thai copy.

- [ ] **Step 5: Add the homepage card and public navigation link**

Add a compact link in the existing `public-hero-secondary-links` group and a `NAV_ITEMS` entry named “แผนที่ห้องปฏิบัติการ / Lab Map”. Reuse the existing `building` icon and preserve responsive scrolling/menu behavior.

- [ ] **Step 6: Run tests and build**

Run each command separately:

```bash
npx tsx scripts/lab-map-public.test.ts
npm run build
```

Expected: public test passes and Next build completes with `/lab-map/[stationCode]` listed as a dynamic route.

- [ ] **Step 7: Commit the public map**

```bash
git add -- "app/(public)/lab-map" "app/(public)/page.tsx" components/layout/PublicNav.tsx lib/lab-map/public.ts scripts/lab-map-public.test.ts package.json
git commit -m "feat(lab-map): add safe public floor map"
```

---

### Task 4: Add the protected staff map shell and navigation

**Files:**
- Create: `app/(protected)/staff/lab-map/page.tsx`
- Create: `components/lab-map/StaffLabMap.tsx`
- Create: `scripts/lab-map-navigation.test.ts`
- Modify: `components/layout/StaffSidebar.tsx`
- Modify: `components/layout/StaffTopbar.tsx`
- Modify: `lib/auth/session-guard.ts`
- Modify: `scripts/session-guard.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: full manifest from Task 1 and reusable shell from Task 2.
- Produces: protected `/staff/lab-map` with overview, infection, and safety modes; personnel mode arrives in Plan 3.

- [ ] **Step 1: Write the failing navigation/security test**

Assert the page exists, the sidebar and topbar contain `/staff/lab-map`, `isProtectedPath('/staff/lab-map')` is true, the public route stays false, and the page passes only serializable DTO data to a Client Component.

- [ ] **Step 2: Verify the test fails**

Run: `npx tsx scripts/lab-map-navigation.test.ts`

Expected: FAIL because the staff route and navigation entries do not exist.

- [ ] **Step 3: Implement the Server/Client split**

The page remains a Server Component, verifies the Supabase session defensively even though the protected layout already does so, builds a plain DTO from the full manifest, and renders `StaffLabMap`. The client renders overview/infection/safety tabs and detail copy; it must not import Supabase or server-only modules.

- [ ] **Step 4: Add navigation and explicit route protection coverage**

Add a top-level staff sidebar entry named “แผนที่ห้องปฏิบัติการ” with no module resource gate so every authenticated staff member can see base geometry. Add the route title to `StaffTopbar`. Keep `PROTECTED_PATH_PATTERN` covering `/staff`; add explicit regression assertions for `/staff/lab-map` and `/lab-map/office` to `scripts/session-guard.test.ts`.

- [ ] **Step 5: Run navigation, session, map, and build checks**

Run each command separately:

```bash
npx tsx scripts/lab-map-navigation.test.ts
npx tsx scripts/session-guard.test.ts
npm run test:lab-map
npm run build
```

Expected: all scripts pass; build lists `/staff/lab-map` under the protected route group.

- [ ] **Step 6: Commit the staff shell**

```bash
git add -- "app/(protected)/staff/lab-map" components/lab-map/StaffLabMap.tsx components/layout/StaffSidebar.tsx components/layout/StaffTopbar.tsx lib/auth/session-guard.ts scripts/session-guard.test.ts scripts/lab-map-navigation.test.ts package.json
git commit -m "feat(lab-map): add protected staff map shell"
```

---

### Task 5: Foundation regression gate

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: all foundation tasks.
- Produces: documented developer workflow and a clean handoff to Visitor Flow Plan.

- [ ] **Step 1: Document manifest maintenance**

Add a concise README section with the source image filenames, `npm run test:lab-map`, the rule that the locked electrical-control door has no route edge, the separation between public/private manifests, and the requirement for physical walkthrough approval.

- [ ] **Step 2: Run the complete foundation gate**

Run each command separately:

```bash
npm run test:lab-map
npx tsx scripts/lab-map-ui.test.ts
npx tsx scripts/lab-map-public.test.ts
npx tsx scripts/lab-map-navigation.test.ts
npx tsx scripts/session-guard.test.ts
npm run build
```

Expected: all tests pass and production build succeeds.

- [ ] **Step 3: Inspect the public bundle contract manually**

Open `/lab-map/office`, inspect the rendered page source/network RSC payload, and verify no strings for `BSL2`, `PCR`, `infectious`, staff names, or `door-electrical-control` are present. Verify the visitor path ends at a fingerprint point.

- [ ] **Step 4: Commit foundation documentation**

```bash
git add README.md
git commit -m "docs(lab-map): document map manifest workflow"
```
