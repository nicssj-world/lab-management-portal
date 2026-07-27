# Equipment Map Placement Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the unplaced-equipment department and Classification filters above the map and add a “ต้องการสอบเทียบ” toggle that filters only the unplaced report.

**Architecture:** Extend the unplaced DTO with the existing `needs_calibration` value, keep filtering in the pure placement-pagination module, and lift report filter state into `EquipmentMapClient`. A focused `PlacementFilters` component renders above the workspace only while the unplaced report is open; `PlacementPanel` receives already-filtered items and remains responsible for five-item pagination and placement actions.

**Tech Stack:** Next.js 16 App Router, React client components, TypeScript, inline component CSS, Node `assert` tests executed with `tsx`.

## Global Constraints

- The calibration filter affects only the “ยังไม่กำหนดตำแหน่ง” report.
- Existing map pins and map-focus filters remain unchanged because the map is for walking area-by-area PM/CAL planning.
- Department, Classification, and calibration filters combine with AND semantics.
- The report renders five equipment cards per page.
- Changing or clearing a filter returns the report to page 1.
- Do not modify unrelated map geometry, room colours, walls, or doors.

---

### Task 1: Unplaced calibration data and pure filtering

**Files:**
- Modify: `lib/equipment-map/types.ts`
- Modify: `lib/equipment-map/server-builder.ts`
- Modify: `lib/equipment-map/placement-pagination.ts`
- Test: `scripts/equipment-map-placement-pagination.test.ts`
- Test: `scripts/equipment-map-domain.test.ts`

**Interfaces:**
- Consumes: `EquipmentMapRow.needsCalibration: boolean`, already populated from `equipment.needs_calibration` in `lib/equipment-map/server.ts`.
- Produces: `EquipmentUnplacedDTO.needsCalibration: boolean` and `filterPlacementItems(items, department, classification, calibrationOnly)`.

- [ ] **Step 1: Write failing filter and DTO propagation tests**

Add `needsCalibration` to the four `filterable` fixtures and assert calibration-only AND behavior:

```ts
const filterable = [
  { id: '1', department: 'เคมีคลินิก', classification: 'A', needsCalibration: true },
  { id: '2', department: 'เคมีคลินิก', classification: 'B', needsCalibration: false },
  { id: '3', department: 'โลหิตวิทยา', classification: 'A', needsCalibration: true },
  { id: '4', department: 'โลหิตวิทยา', classification: null, needsCalibration: false },
]
assert.deepEqual(filterPlacementItems(filterable, '', '', true).map((item) => item.id), ['1', '3'])
assert.deepEqual(filterPlacementItems(filterable, 'เคมีคลินิก', 'A', true).map((item) => item.id), ['1'])
```

In the domain test, assert that an unplaced source row with `needsCalibration: true` produces an unplaced DTO whose `needsCalibration` is true.

- [ ] **Step 2: Run tests and verify the new behavior fails**

Run:

```powershell
npx tsx scripts/equipment-map-placement-pagination.test.ts
npx tsx scripts/equipment-map-domain.test.ts
```

Expected: FAIL because `filterPlacementItems` has no calibration argument/behavior and `EquipmentUnplacedDTO` does not expose `needsCalibration`.

- [ ] **Step 3: Implement the minimal data contract and filter**

Add the DTO property and builder mapping:

```ts
export interface EquipmentUnplacedDTO {
  // existing fields
  needsCalibration: boolean
}
```

```ts
unplaced.push({
  // existing fields
  needsCalibration: row.needsCalibration,
})
```

Extend the pure filter:

```ts
interface PlacementFilterable {
  department: string
  classification: string | null
  needsCalibration: boolean
}

export function filterPlacementItems<T extends PlacementFilterable>(
  items: readonly T[],
  department: string,
  classification: string,
  calibrationOnly = false,
): T[] {
  return items.filter((item) => {
    if (department && item.department.trim() !== department) return false
    if (classification === UNCLASSIFIED_FILTER && item.classification?.trim()) return false
    if (classification && classification !== UNCLASSIFIED_FILTER && item.classification?.trim() !== classification) return false
    if (calibrationOnly && !item.needsCalibration) return false
    return true
  })
}
```

- [ ] **Step 4: Run focused tests and verify they pass**

Run:

```powershell
npx tsx scripts/equipment-map-placement-pagination.test.ts
npx tsx scripts/equipment-map-domain.test.ts
```

Expected: both scripts print their passing messages.

- [ ] **Step 5: Commit the data/filter change**

```powershell
git add -- lib/equipment-map/types.ts lib/equipment-map/server-builder.ts lib/equipment-map/placement-pagination.ts scripts/equipment-map-placement-pagination.test.ts scripts/equipment-map-domain.test.ts
git commit -m "feat: filter unplaced calibration equipment"
```

### Task 2: Dedicated placement filter toolbar

**Files:**
- Create: `components/equipment-map/PlacementFilters.tsx`
- Modify: `scripts/equipment-map-ui.test.ts`

**Interfaces:**
- Consumes: `placementFilterOptions(unplaced)`, `UNCLASSIFIED_FILTER`, current filter values, and callbacks owned by `EquipmentMapClient`.
- Produces: `PlacementFilters` with props `unplaced`, `department`, `classification`, `calibrationOnly`, `onDepartmentChange`, `onClassificationChange`, `onCalibrationOnlyChange`, and `onClear`. Existing `PlacementPanel` behavior remains unchanged until Task 3 integrates the new toolbar atomically.

- [ ] **Step 1: Write failing UI contract assertions**

Add an existence assertion before reading the new toolbar source, then assert its required controls:

```ts
import { existsSync, readFileSync } from 'node:fs'

const placementFiltersPath = 'components/equipment-map/PlacementFilters.tsx'
assert.ok(existsSync(placementFiltersPath), 'the placement filter toolbar component must exist')
const placementFilters = read(placementFiltersPath)
assert.match(placementFilters, /aria-pressed={calibrationOnly}/, 'the calibration control must expose its toggle state')
assert.match(placementFilters, /ต้องการสอบเทียบ/, 'the placement toolbar must include the calibration filter')
assert.match(placementFilters, /ทุกแผนก/, 'the placement toolbar must include the department filter')
assert.match(placementFilters, /ทุก Classification/, 'the placement toolbar must include the Classification filter')
```

- [ ] **Step 2: Run the UI contract and verify it fails**

Run:

```powershell
npx tsx scripts/equipment-map-ui.test.ts
```

Expected: FAIL at the existence assertion because `PlacementFilters.tsx` does not exist.

- [ ] **Step 3: Implement `PlacementFilters`**

Implement a semantic toolbar with two labelled selects, a system `Button` rendered with `aria-pressed`, and a clear button shown when any filter is active. Keep filter option generation inside this focused component. Do not change `PlacementPanel` in this task.

Core toggle markup:

```tsx
<Button
  variant={calibrationOnly ? 'primary' : 'secondary'}
  aria-pressed={calibrationOnly}
  onClick={() => onCalibrationOnlyChange(!calibrationOnly)}
>
  ต้องการสอบเทียบ
</Button>
```

- [ ] **Step 4: Run the UI contract and TypeScript**

Run:

```powershell
npx tsx scripts/equipment-map-ui.test.ts
npx tsc --noEmit
```

Expected: UI assertions and TypeScript both pass; the new component is not rendered until Task 3.

- [ ] **Step 5: Commit the component boundary change**

```powershell
git add -- components/equipment-map/PlacementFilters.tsx scripts/equipment-map-ui.test.ts
git commit -m "refactor: separate placement filter toolbar"
```

### Task 3: Client integration, styling, and verification

**Files:**
- Modify: `components/equipment-map/EquipmentMapClient.tsx`
- Modify: `components/equipment-map/PlacementPanel.tsx`
- Modify: `components/equipment-map/EquipmentMapStyles.tsx`
- Modify: `scripts/equipment-map-ui.test.ts`

**Interfaces:**
- Consumes: `filterPlacementItems(map.unplaced, department, classification, calibrationOnly)` and `PlacementFilters` from Tasks 1–2.
- Produces: a report-only toolbar above `.lab-map-workspace` and a `PlacementPanel` that receives the filtered item list.

- [ ] **Step 1: Add failing placement-state integration assertions**

Add assertions that `EquipmentMapClient` owns all three filter values, computes `filteredUnplaced`, passes it to `PlacementPanel`, and resets page behavior through a `filterRevision` key. Assert that the toolbar appears before `<div className="lab-map-workspace">` in source order, and that `PlacementPanel` no longer contains `equipment-placement-filters`.

- [ ] **Step 2: Run the UI test and verify the integration assertions fail**

Run:

```powershell
npx tsx scripts/equipment-map-ui.test.ts
```

Expected: FAIL because the client does not yet own or render placement filters.

- [ ] **Step 3: Lift state and render the toolbar**

Add state and filtered data in `EquipmentMapClient`:

```ts
const [placementDepartment, setPlacementDepartment] = useState('')
const [placementClassification, setPlacementClassification] = useState('')
const [placementCalibrationOnly, setPlacementCalibrationOnly] = useState(false)
const [placementFilterRevision, setPlacementFilterRevision] = useState(0)

const filteredUnplaced = useMemo(
  () => filterPlacementItems(map.unplaced, placementDepartment, placementClassification, placementCalibrationOnly),
  [map.unplaced, placementDepartment, placementClassification, placementCalibrationOnly],
)
```

Each toolbar callback updates its value and increments `placementFilterRevision`. Render `<PlacementFilters ... />` only under `showPlacement`, immediately before the workspace. Remove `useMemo`, filter state, filter selects, and `clearFilters` from `PlacementPanel`; rename its `unplaced` prop to `items` and paginate `items` directly. The empty state and panel heading use the filtered `items.length`. Pass `items={filteredUnplaced}` and `key={placementFilterRevision}` to `PlacementPanel` so every filter change remounts pagination at page 1. Clear resets all three values and increments the revision.

- [ ] **Step 4: Add responsive toolbar styling**

Replace the old sidebar-only `.equipment-placement-filters` rules with `.equipment-placement-toolbar` rules: desktop uses a wrapping horizontal flex/grid row, selects retain 44px touch targets, the action group stays aligned, and the mobile media query stacks controls to one column. Do not change workspace geometry, map colours, walls, or doors.

- [ ] **Step 5: Run the complete automated verification**

Run:

```powershell
npx tsx scripts/equipment-map-domain.test.ts
npx tsx scripts/equipment-map-pagination.test.ts
npx tsx scripts/equipment-map-placement-pagination.test.ts
npx tsx scripts/equipment-map-ui.test.ts
npx tsc --noEmit
git diff --check
```

Expected: all equipment-map scripts print passing messages, TypeScript exits 0, and `git diff --check` produces no output.

- [ ] **Step 6: Verify in the running Chrome page**

Open the existing authenticated `/staff/equipment/map` page, open “ยังไม่กำหนดตำแหน่ง”, and confirm:

1. The two selects and “ต้องการสอบเทียบ” appear above the workspace.
2. The right panel contains no duplicate filters.
3. Toggling calibration reduces the report to rows whose source `needs_calibration` is true.
4. Combining department and Classification further narrows the same list.
5. Every filter change returns pagination to page 1 and still displays at most five cards.
6. Closing the report removes the placement toolbar and leaves map focus filters/pins unchanged.

- [ ] **Step 7: Commit the integrated feature**

```powershell
git add -- components/equipment-map/EquipmentMapClient.tsx components/equipment-map/PlacementPanel.tsx components/equipment-map/EquipmentMapStyles.tsx scripts/equipment-map-ui.test.ts
git commit -m "feat: move unplaced filters above equipment map"
```
