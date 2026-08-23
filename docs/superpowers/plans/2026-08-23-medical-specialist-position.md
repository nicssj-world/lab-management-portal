# เพิ่มตำแหน่งนายแพทย์เชี่ยวชาญ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มตัวเลือก `นายแพทย์เชี่ยวชาญ` ใน dropdown ตำแหน่งของโมดัลแก้ไขประวัติบุคลากร

**Architecture:** ใช้ `POSITION_OPTIONS` เดิมใน `StaffDetailClient.tsx` และเพิ่มค่าใหม่ต่อท้าย เพื่อคงลำดับตัวเลือกเดิมและใช้ data flow ของ `position_title` เดิมทั้งหมด ไม่เพิ่ม abstraction หรือเปลี่ยน API/ฐานข้อมูล

**Tech Stack:** Next.js 16, React 19, TypeScript, `tsx`, Node `assert`

## Global Constraints

- เปลี่ยนเฉพาะ dropdown ตำแหน่งในโมดัล `แก้ไขประวัติบุคลากร`
- เพิ่ม `นายแพทย์เชี่ยวชาญ` ต่อท้าย `POSITION_OPTIONS` และคงตัวเลือกเดิมตามลำดับเดิม
- ไม่เปลี่ยน API, schema, ฐานข้อมูล หรือหน้าจอส่วนอื่น
- เขียน test ให้ fail ก่อนแก้ production code แล้วจึงเพิ่มโค้ดขั้นต่ำให้ผ่าน

---

### Task 1: เพิ่มและตรวจสอบตัวเลือกตำแหน่ง

**Files:**
- Create: `scripts/personnel-position-options.test.ts`
- Modify: `app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx:490-499`

**Interfaces:**
- Test reads the existing `POSITION_OPTIONS` source block and verifies its exact ordered labels.
- The modal continues to render options through `optionsWithCurrent(POSITION_OPTIONS, form.position_title)`.

- [x] **Step 1: Write the failing test**

Create `scripts/personnel-position-options.test.ts`:

```ts
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx', 'utf8')
const block = source.match(/const POSITION_OPTIONS\s*=\s*\[([\s\S]*?)\r?\n\]/)
const optionsBody = block?.[1] ?? ''
assert.ok(optionsBody, 'POSITION_OPTIONS must remain declared in the personnel detail client')

const positions = [...optionsBody.matchAll(/'([^']+)'/g)].map((match) => match[1])
assert.deepEqual(positions, [
  'นักเทคนิคการแพทย์',
  'นักเทคนิคการแพทย์ปฏิบัติการ',
  'นักเทคนิคการแพทย์ชำนาญการ',
  'นักเทคนิคการแพทย์ชำนาญการพิเศษ',
  'จพง.วิทยาศาสตร์การแพทย์ชำนาญงาน',
  'จพง.วิทยาศาสตร์การแพทย์ปฏิบัติงาน',
  'พนักงานประจำห้องทดลอง',
  'พนักงานบริการ',
  'นายแพทย์เชี่ยวชาญ',
])

assert.match(
  source,
  /optionsWithCurrent\(POSITION_OPTIONS, form\.position_title\)\.map/,
  'the position select must render POSITION_OPTIONS',
)

console.log('scripts/personnel-position-options.test.ts: all assertions passed')
```

- [x] **Step 2: Run the test to verify it fails for the missing option**

Run: `npx tsx scripts/personnel-position-options.test.ts`

Expected: FAIL with an `AssertionError` because the current eight-item array does not yet contain `นายแพทย์เชี่ยวชาญ`.

- [x] **Step 3: Add the minimal production change**

Append one item to `POSITION_OPTIONS` in `StaffDetailClient.tsx`, immediately after `พนักงานบริการ`:

```ts
  'พนักงานบริการ',
  'นายแพทย์เชี่ยวชาญ',
]
```

Do not change `optionsWithCurrent`, the `<select>`, the API payload, or any other option.

- [x] **Step 4: Run the focused test to verify it passes**

Run: `npx tsx scripts/personnel-position-options.test.ts`

Expected: PASS and `all assertions passed`.

- [x] **Step 5: Run type/build verification**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no TypeScript errors.

Run: `npm run build`

Expected: production build completes successfully. If the environment reports an unrelated pre-existing warning, record it without changing unrelated code.

- [x] **Step 6: Commit the implementation**

```bash
git add -- "app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx" scripts/personnel-position-options.test.ts docs/superpowers/plans/2026-08-23-medical-specialist-position.md
git commit -m "feat: add medical specialist personnel position"
```
