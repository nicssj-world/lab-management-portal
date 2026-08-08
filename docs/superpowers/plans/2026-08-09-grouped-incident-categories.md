# Grouped Incident Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single incident-category select on /staff/risk/report with an accessible multi-open accordion that preserves the existing event_category string payload and adds the 10 requested blood-use categories.

**Architecture:** Keep the category catalog in components/risk/shared/tokens.ts as one grouped source of truth, derive the existing flat category list from it, and expose a pure lookup helper for selected-category restoration. Keep all accordion state and rendering inside the existing client-side IncidentReportForm; do not change the server page, API route, schema, database, or proxy.

**Tech Stack:** Next.js 16.2.6 App Router, React 19.2.4 Client Component, TypeScript, existing inline-style UI primitives, Node assert tests executed with tsx.

## Global Constraints

- Increase the incident category UI to 7 groups and 28 unique values (the original 18 plus 10 new blood-use values).
- The accordion must allow multiple groups to be open at once; all groups start closed.
- Use native buttons and native radio inputs; preserve event_category as the submitted string.
- Keep the existing risk.incident-report.draft Local Storage key and existing API request body unchanged.
- Do not change the API, validation schema, database, or protected-route proxy.
- Do not change existing category copy; use the exact new blood-category copy from the approved spec.
- Preserve unrelated worktree changes. Stage only files listed by the current task when committing.
- Before writing implementation code, follow the repository's AGENTS.md instruction by reading the relevant installed Next.js guides under node_modules/next/dist/docs/.

---

## File Map

- components/risk/shared/tokens.ts — owns the grouped category catalog, the derived flat list, and the pure category-to-group lookup.
- components/risk/IncidentReportForm.tsx — owns accordion open state, selected radio rendering, draft restoration synchronization, and validation focus behavior.
- scripts/incident-category-groups.test.ts — tests the grouped catalog, exact new values, flattening, uniqueness, and lookup helper.
- scripts/incident-report-category-ui.test.ts — repository-style source contract test for the rendered accordion semantics and preservation of the radio field name.

## Task 1: Add the grouped category contract and catalog

**Files:**

- Create: scripts/incident-category-groups.test.ts
- Modify: components/risk/shared/tokens.ts:163-182

**Interfaces:**

- Produces IncidentCategoryGroup with readonly id, label, and items fields.
- Produces INCIDENT_CATEGORY_GROUPS: readonly IncidentCategoryGroup[].
- Keeps INCIDENT_CATEGORIES as the flattened category list.
- Produces incidentCategoryGroupFor(category?: string | null): IncidentCategoryGroup | undefined.

- [ ] **Step 1: Write the failing catalog test**

Create scripts/incident-category-groups.test.ts with a runtime module cast so the initial missing exports fail as an assertion (not as a TypeScript import error):

    import assert from 'node:assert/strict'
    import * as tokenModule from '@/components/risk/shared/tokens'

    type CategoryGroup = {
      id: string
      label: string
      items: readonly string[]
    }

    type TokenModule = typeof tokenModule & {
      INCIDENT_CATEGORY_GROUPS?: readonly CategoryGroup[]
      incidentCategoryGroupFor?: (category?: string | null) => CategoryGroup | undefined
    }

    const tokens = tokenModule as TokenModule

    assert.ok(tokens.INCIDENT_CATEGORY_GROUPS, 'INCIDENT_CATEGORY_GROUPS must be exported')
    assert.ok(tokens.incidentCategoryGroupFor, 'incidentCategoryGroupFor must be exported')

    const groups = tokens.INCIDENT_CATEGORY_GROUPS!
    const categories = tokens.INCIDENT_CATEGORIES as readonly string[]
    const expectedLabels = [
      'สิ่งส่งตรวจ/การรับตัวอย่าง',
      'การระบุตัวตน/ใบส่งตรวจ',
      'การขนส่ง/กระบวนการ',
      'ระบบ/วัสดุ/อื่นๆ',
      'คำสั่งการใช้เลือดคลาดเคลื่อน',
      'การจ่ายเลือดคลาดเคลื่อน',
      'การบริหารเลือดคลาดเคลื่อน',
    ]
    const expectedBloodCategories = [
      'สั่งเลือด/ส่วนประกอบเลือดผิดจำนวน',
      'สั่งเลือด/ส่วนประกอบเลือดผิดชนิด/ไม่ตรงชนิด',
      'สั่งเลือด/ส่วนประกอบเลือดผิดคน',
      'จ่ายเลือด/ส่วนประกอบเลือดล่าช้า',
      'จ่ายเลือด/ส่วนประกอบเลือดผิดจำนวน/ชนิด',
      'จ่ายเลือด/ส่วนประกอบเลือดผิดคน',
      'ไม่ให้เลือด/ส่วนประกอบเลือด',
      'เกิดปฏิกิริยาหลังให้เลือด',
      'เกิดปฏิกิริยาหลังให้เลือดรุนแรง',
      'ให้เลือดผิดหมู่',
    ]

    assert.deepEqual(groups.map(group => group.label), expectedLabels)
    assert.equal(groups.length, 7)
    assert.equal(categories.length, 28)
    assert.equal(new Set(categories).size, 28)
    assert.deepEqual(
      [...categories],
      groups.flatMap(group => [...group.items]),
    )
    for (const category of expectedBloodCategories) {
      assert.ok(categories.includes(category), 'missing category: ' + category)
    }
    assert.equal(
      tokens.incidentCategoryGroupFor!('สั่งเลือด/ส่วนประกอบเลือดผิดคน')?.id,
      'blood-order',
    )
    assert.equal(tokens.incidentCategoryGroupFor!('not-a-real-category'), undefined)

    console.log('incident category groups passed')

- [ ] **Step 2: Run the test and verify the expected red failure**

Run:

    npx tsx scripts/incident-category-groups.test.ts

Expected: the command fails with an assertion containing INCIDENT_CATEGORY_GROUPS must be exported, because the current tokens file still exports only the old flat array.

- [ ] **Step 3: Replace the flat catalog with the grouped source of truth**

Replace the existing INCIDENT_CATEGORIES block in components/risk/shared/tokens.ts with this catalog and helper:

    export type IncidentCategoryGroup = {
      readonly id: string
      readonly label: string
      readonly items: readonly string[]
    }

    export const INCIDENT_CATEGORY_GROUPS = [
      {
        id: 'specimen',
        label: 'สิ่งส่งตรวจ/การรับตัวอย่าง',
        items: [
          'สิ่งส่งตรวจ Hemolysis',
          'สิ่งส่งตรวจ Turbid',
          'สิ่งส่งตรวจ clot',
          'สิ่งส่งตรวจปริมาตรไม่เพียงพอสำหรับการทดสอบ',
          'สิ่งส่งตรวจผิดชนิด หรือ ใส่ภาชนะผิดชนิด',
          'ตัวอย่างไม่ครบตามใบส่งตรวจ',
          'สิ่งส่งตรวจหก - แตก เลอะ',
        ],
      },
      {
        id: 'identity',
        label: 'การระบุตัวตน/ใบส่งตรวจ',
        items: [
          'ชื่อใบนำส่งตรวจกับสิ่งส่งตรวจไม่ตรงกัน',
          'เก็บสิ่งส่งตรวจผิดราย',
          'Request ผิดราย',
          'ติด Barcode ผิดราย',
          'ไม่ติดชื่อสกุลบนภาชนะที่ส่งตรวจ',
        ],
      },
      {
        id: 'process',
        label: 'การขนส่ง/กระบวนการ',
        items: [
          'ไม่ได้รับสิ่งส่งตรวจ',
          'ส่งสิ่งส่งตรวจเกินระยะเวลาที่กำหนด',
        ],
      },
      {
        id: 'system',
        label: 'ระบบ/วัสดุ/อื่นๆ',
        items: [
          'ระบบ LIS ขัดข้อง',
          'ระบบ HIS ขัดข้อง',
          'Reagent หมดอายุ',
          'อื่นๆ',
        ],
      },
      {
        id: 'blood-order',
        label: 'คำสั่งการใช้เลือดคลาดเคลื่อน',
        items: [
          'สั่งเลือด/ส่วนประกอบเลือดผิดจำนวน',
          'สั่งเลือด/ส่วนประกอบเลือดผิดชนิด/ไม่ตรงชนิด',
          'สั่งเลือด/ส่วนประกอบเลือดผิดคน',
        ],
      },
      {
        id: 'blood-issue',
        label: 'การจ่ายเลือดคลาดเคลื่อน',
        items: [
          'จ่ายเลือด/ส่วนประกอบเลือดล่าช้า',
          'จ่ายเลือด/ส่วนประกอบเลือดผิดจำนวน/ชนิด',
          'จ่ายเลือด/ส่วนประกอบเลือดผิดคน',
        ],
      },
      {
        id: 'blood-administration',
        label: 'การบริหารเลือดคลาดเคลื่อน',
        items: [
          'ไม่ให้เลือด/ส่วนประกอบเลือด',
          'เกิดปฏิกิริยาหลังให้เลือด',
          'เกิดปฏิกิริยาหลังให้เลือดรุนแรง',
          'ให้เลือดผิดหมู่',
        ],
      },
    ] as const satisfies readonly IncidentCategoryGroup[]

    export const INCIDENT_CATEGORIES = INCIDENT_CATEGORY_GROUPS.flatMap(group => group.items)

    export function incidentCategoryGroupFor(category?: string | null): IncidentCategoryGroup | undefined {
      if (!category) return undefined
      return INCIDENT_CATEGORY_GROUPS.find(group => (group.items as readonly string[]).includes(category))
    }

- [ ] **Step 4: Run the catalog test and verify green**

Run:

    npx tsx scripts/incident-category-groups.test.ts

Expected: incident category groups passed and exit code 0. This verifies the 7 labels, all 28 unique values, exact blood copy, flattening, and lookup behavior.

- [ ] **Step 5: Commit the independently tested catalog**

Stage only the task files and commit:

    git add -- components/risk/shared/tokens.ts scripts/incident-category-groups.test.ts
    git commit -m "feat: group incident category catalog"

## Task 2: Replace the select with the accordion UI

**Files:**

- Create: scripts/incident-report-category-ui.test.ts
- Modify: components/risk/IncidentReportForm.tsx:3,10-13,64-70,98-109,289-300

**Interfaces:**

- Consumes INCIDENT_CATEGORY_GROUPS and incidentCategoryGroupFor from Task 1.
- Preserves the existing Draft.event_category: string, set({ event_category }), validation, Local Storage key, and POST body.
- Produces a native-radio accordion with data-event-category-trigger on every group header for validation focus.

- [ ] **Step 1: Read the installed Next.js guides before changing the Client Component**

Run:

    Get-Content -Raw node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md
    Get-Content -Raw node_modules/next/dist/docs/01-app/02-guides/forms.md
    Get-Content -Raw node_modules/next/dist/docs/03-architecture/accessibility.md

Expected: confirm that state, event handlers, and localStorage belong in the existing 'use client' component, and that native form controls plus explicit accessibility attributes are appropriate. Do not convert the page or form to Server Actions.

- [ ] **Step 2: Write the failing UI contract test**

Create scripts/incident-report-category-ui.test.ts:

    import assert from 'node:assert/strict'
    import { readFileSync } from 'node:fs'
    import { join } from 'node:path'

    const source = readFileSync(
      join(process.cwd(), 'components', 'risk', 'IncidentReportForm.tsx'),
      'utf8',
    ).replace(/\r\n/g, '\n')

    assert.match(source, /INCIDENT_CATEGORY_GROUPS/)
    assert.match(source, /incidentCategoryGroupFor/)
    assert.match(source, /aria-expanded=/)
    assert.match(source, /aria-controls=/)
    assert.match(source, /data-event-category-trigger/)
    assert.match(source, /type="radio"/)
    assert.match(source, /name="event_category"/)
    assert.match(source, /setOpenGroups/)
    assert.doesNotMatch(source, /<select[^>]*id="event_category"/)

    console.log('incident report category UI contract passed')

- [ ] **Step 3: Run the UI contract test and verify the expected red failure**

Run:

    npx tsx scripts/incident-report-category-ui.test.ts

Expected: the command fails at the first missing accordion contract because the current component still renders the event_category select.

- [ ] **Step 4: Add grouped state and selected-group restoration**

In IncidentReportForm.tsx, replace the INCIDENT_CATEGORIES import with the grouped catalog and helper, then add the open-group state beside the existing draft state:

    import {
      FONT, INCIDENT_CATEGORY_GROUPS, LAB_DEPARTMENTS, REPORTER_POSITIONS, SPACE,
      incidentCategoryGroupFor, inputStyle, tabularNums, textareaStyle, todayIso,
    } from './shared/tokens'

    const [openGroups, setOpenGroups] = useState<string[]>([])

Add this effect after the existing draft-restoration effect. It opens the selected group after a restored draft is applied and keeps the group open after a new selection:

    useEffect(() => {
      const group = incidentCategoryGroupFor(draft.event_category)
      if (!group) return
      setOpenGroups(previous => previous.includes(group.id) ? previous : [...previous, group.id])
    }, [draft.event_category])

- [ ] **Step 5: Make validation focus the accordion trigger when category is missing**

Replace the current generic focus block inside submit with this conditional. Other fields keep the existing [name="..."] focus behavior:

    if (firstInvalid) {
      if (firstInvalid === 'event_category') {
        const firstGroupId = INCIDENT_CATEGORY_GROUPS[0]?.id
        if (firstGroupId) {
          setOpenGroups(previous => previous.includes(firstGroupId) ? previous : [...previous, firstGroupId])
        }
        formRef.current?.querySelector<HTMLElement>('[data-event-category-trigger]')?.focus()
      } else {
        formRef.current?.querySelector<HTMLElement>('[name="' + firstInvalid + '"]')?.focus()
      }
      return
    }

- [ ] **Step 6: Replace the category select with the native-radio accordion**

Replace the existing Field block from label="ประเภทเหตุการณ์" through its closing </Field> with this implementation. It keeps all radio inputs in one name group, permits multiple accordion panels to be open, shows a selected summary in the header, and leaves the API-facing draft value unchanged:

    <Field
      label="ประเภทเหตุการณ์"
      required
      error={errorOf('event_category')}
      htmlFor="event-category-group-specimen"
    >
      <div
        id="event_category"
        role="radiogroup"
        aria-label="ประเภทเหตุการณ์"
        aria-required="true"
        aria-invalid={Boolean(errorOf('event_category'))}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {INCIDENT_CATEGORY_GROUPS.map(group => {
          const isOpen = openGroups.includes(group.id)
          const isSelected = (group.items as readonly string[]).includes(draft.event_category)
          const triggerId = 'event-category-group-' + group.id
          const optionsId = triggerId + '-options'

          return (
            <div
              key={group.id}
              style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}
            >
              <button
                id={triggerId}
                data-event-category-trigger
                type="button"
                aria-expanded={isOpen}
                aria-controls={optionsId}
                onClick={() => setOpenGroups(previous => (
                  previous.includes(group.id)
                    ? previous.filter(id => id !== group.id)
                    : [...previous, group.id]
                ))}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm,
                  width: '100%', minHeight: 48, padding: '10px 12px', border: 0,
                  background: isSelected ? 'var(--primary-soft)' : 'var(--card)',
                  color: 'var(--ink)', font: 'inherit', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700 }}>
                  {isSelected && <Icon name="check" size={15} style={{ color: 'var(--primary)', flex: '0 0 auto' }} />}
                  <span>{group.label}</span>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flex: '0 0 auto', color: 'var(--muted)', fontSize: FONT.xs }}>
                  <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isSelected ? 'เลือกแล้ว · ' + draft.event_category : group.items.length + ' รายการ'}
                  </span>
                  <Icon name="chevDown" size={15} style={{ transform: isOpen ? 'rotate(180deg)' : undefined }} />
                </span>
              </button>

              {isOpen && (
                <div
                  id={optionsId}
                  role="group"
                  aria-labelledby={triggerId}
                  style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)' }}
                >
                  {group.items.map((category, index) => {
                    const optionId = 'event-category-' + group.id + '-' + index
                    const checked = draft.event_category === category
                    return (
                      <label
                        key={category}
                        htmlFor={optionId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, minHeight: 44,
                          padding: '9px 12px', borderBottom: index === group.items.length - 1 ? 0 : '1px solid var(--border)',
                          background: checked ? 'color-mix(in srgb, var(--primary) 8%, var(--card))' : 'var(--card)',
                          color: 'var(--ink)', cursor: 'pointer',
                        }}
                      >
                        <input
                          id={optionId}
                          name="event_category"
                          type="radio"
                          value={category}
                          checked={checked}
                          onChange={e => set({ event_category: e.target.value })}
                          onBlur={blur('event_category')}
                          style={{ width: 18, height: 18, flex: '0 0 auto', accentColor: 'var(--primary)' }}
                        />
                        <span style={{ flex: 1, minWidth: 0, fontSize: FONT.md, lineHeight: 1.45 }}>{category}</span>
                        {checked && <Icon name="check" size={16} style={{ color: 'var(--primary)', flex: '0 0 auto' }} />}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Field>

- [ ] **Step 7: Run the UI contract test and verify green**

Run:

    npx tsx scripts/incident-report-category-ui.test.ts

Expected: incident report category UI contract passed and exit code 0.

- [ ] **Step 8: Commit the accordion UI separately**

Stage only the task files and commit:

    git add -- components/risk/IncidentReportForm.tsx scripts/incident-report-category-ui.test.ts
    git commit -m "feat: add grouped incident category picker"

## Task 3: Run integration checks and acceptance verification

**Files:**

- Read only: components/risk/shared/tokens.ts
- Read only: components/risk/IncidentReportForm.tsx
- Read only: lib/validations/incident.ts
- Read only: app/(protected)/staff/risk/report/page.tsx

**Interfaces:**

- Consumes the two passing contract tests and the existing report route.
- Produces no additional source changes unless a check identifies a concrete TypeScript or behavior defect.

- [ ] **Step 1: Run both focused tests together**

Run:

    npx tsx scripts/incident-category-groups.test.ts
    npx tsx scripts/incident-report-category-ui.test.ts

Expected: both commands exit 0 and print their respective passed messages.

- [ ] **Step 2: Check formatting and compile the application**

Run:

    git diff --check HEAD~2..HEAD
    npm run build

Expected: git diff --check produces no whitespace errors and npm run build completes successfully. If the build reports an existing unrelated worktree failure, record the exact error and do not alter unrelated files.

- [ ] **Step 3: Perform the focused acceptance checklist**

Review the rendered /staff/risk/report form in the existing local app and verify each behavior:

1. The category field shows 7 closed group headers and no old category select.
2. Clicking one header opens only that header; opening another leaves the first open.
3. Each open group exposes its exact radio options; selecting one marks only that value and shows the selected summary on its group header.
4. Refreshing with a non-empty risk.incident-report.draft opens the group containing the restored category.
5. Submitting without a category opens the first group, focuses its header, and shows ต้องเลือกประเภทเหตุการณ์.
6. Selecting a new category still leaves the POST payload field named event_category and does not alter the other draft fields.
7. The original 18 categories remain available and the 10 blood categories appear exactly once.

- [ ] **Step 4: Inspect final worktree scope**

Run:

    git status --short
    git diff --stat HEAD~2..HEAD

Expected: the two feature commits contain only the planned category/test files, while the user's pre-existing components/quality-tasks/QualityTaskDashboard.tsx and polling files remain untouched.
