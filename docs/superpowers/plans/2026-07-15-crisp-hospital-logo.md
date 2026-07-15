# Crisp Hospital Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the blue-and-pink Chonburi Hospital logo sharply, at its natural 3:2 ratio, in every web UI location.

**Architecture:** A focused `HospitalLogo` component owns the hospital-logo asset and all presentation rules. The shared `Logo` row and the login page consume it, preventing the public header/footer and login page from drifting into different sizing or image-processing behavior.

**Tech Stack:** Next.js 16.2.6 App Router, React 19, TypeScript, `next/image`, Node `assert` static regression tests run with `tsx`.

## Global Constraints

- Preserve the existing blue-and-pink artwork at `/images/logo-chonburi.png`; do not redraw, replace, or crop it.
- Preserve its intrinsic 3:2 display ratio: rendered width is `height * 1.5`.
- Use `next/image` with `unoptimized` for this image so the source PNG is served as-is.
- Keep `objectFit: 'contain'`, `flexShrink: 0`, descriptive Thai alt text, and existing preload behavior.
- Do not modify the circular Medical Technology logo, generated-PDF hospital seal, or surrounding text/copy.
- Use `apply_patch` for all file edits.

---

### Task 1: Introduce a reusable, ratio-safe HospitalLogo component

**Files:**
- Create: `components/lab/HospitalLogo.tsx`
- Create: `scripts/hospital-logo.test.ts`

**Interfaces:**
- Consumes: the existing public image path `/images/logo-chonburi.png`.
- Produces: `HospitalLogo({ height, preload? }: HospitalLogoProps)`, which renders the hospital-logo `Image` at `width={height * 1.5}` and `height={height}`.

- [ ] **Step 1: Write the failing static regression test**

Create `scripts/hospital-logo.test.ts`:

```ts
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const componentPath = 'components/lab/HospitalLogo.tsx'

assert.ok(existsSync(componentPath), 'HospitalLogo must provide one shared web rendering for the hospital logo')

const source = readFileSync(componentPath, 'utf8')

assert.match(source, /const width = height \* 1\.5/, 'the hospital logo must retain its intrinsic 3:2 ratio')
assert.match(source, /src="\/images\/logo-chonburi\.png"/, 'HospitalLogo must own the approved hospital-logo source')
assert.match(source, /width=\{width\}/, 'HospitalLogo must supply the ratio-safe width to next/image')
assert.match(source, /height=\{height\}/, 'HospitalLogo must supply its requested display height to next/image')
assert.match(source, /unoptimized/, 'HospitalLogo must serve the source PNG without Next.js recompression')
assert.match(source, /objectFit: 'contain'/, 'HospitalLogo must preserve the whole mark without cropping')
assert.match(source, /flexShrink: 0/, 'HospitalLogo must not be compressed by surrounding navigation content')
assert.match(source, /alt="โรงพยาบาลชลบุรี"/, 'HospitalLogo must retain meaningful accessible text')

console.log('hospital logo component tests passed')
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/hospital-logo.test.ts`

Expected: failure saying `HospitalLogo must provide one shared web rendering for the hospital logo`, because the component does not exist yet.

- [ ] **Step 3: Write the minimal component implementation**

Create `components/lab/HospitalLogo.tsx`:

```tsx
import Image from 'next/image'

interface HospitalLogoProps {
  height: number
  preload?: boolean
}

export function HospitalLogo({ height, preload = false }: HospitalLogoProps) {
  const width = height * 1.5

  return (
    <Image
      src="/images/logo-chonburi.png"
      alt="โรงพยาบาลชลบุรี"
      width={width}
      height={height}
      preload={preload}
      unoptimized
      style={{ width, height, flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
```

- [ ] **Step 4: Run the component regression test to verify it passes**

Run: `npx tsx scripts/hospital-logo.test.ts`

Expected: `hospital logo component tests passed` with exit code 0.

- [ ] **Step 5: Commit the independently testable component**

```bash
git add components/lab/HospitalLogo.tsx scripts/hospital-logo.test.ts
git commit -m "feat: add sharp hospital logo component"
```

### Task 2: Adopt HospitalLogo across shared and login UI

**Files:**
- Modify: `components/lab/Logo.tsx`
- Modify: `app/login/page.tsx`
- Modify: `components/layout/PublicNav.tsx`
- Modify: `scripts/hospital-logo.test.ts`

**Interfaces:**
- Consumes: `HospitalLogo({ height, preload? })` from `components/lab/HospitalLogo.tsx`.
- Produces: public header/footer and login page that render the same ratio-safe hospital logo, including mobile sizing that does not turn it square.

- [ ] **Step 1: Extend the failing regression test with all consumer requirements**

Append this before `console.log` in `scripts/hospital-logo.test.ts`:

```ts
const sharedLogo = readFileSync('components/lab/Logo.tsx', 'utf8')
const loginPage = readFileSync('app/login/page.tsx', 'utf8')
const publicNav = readFileSync('components/layout/PublicNav.tsx', 'utf8')

assert.match(sharedLogo, /import \{ HospitalLogo \} from '@\/components\/lab\/HospitalLogo'/)
assert.match(sharedLogo, /<HospitalLogo height=\{size\} preload \/>/)
assert.doesNotMatch(sharedLogo, /src="\/images\/logo-chonburi\.png"/)

assert.match(loginPage, /import \{ HospitalLogo \} from '@\/components\/lab\/HospitalLogo'/)
assert.match(loginPage, /<HospitalLogo height=\{64\} preload \/>/)
assert.doesNotMatch(loginPage, /src="\/images\/logo-chonburi\.png"/)

assert.doesNotMatch(publicNav, /\.pub-logo-link img\s*\{[\s\S]*?width:\s*48px !important;[\s\S]*?height:\s*48px !important;/)
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx scripts/hospital-logo.test.ts`

Expected: failure for the missing `HospitalLogo` import in `components/lab/Logo.tsx` because consumers have not migrated yet.

- [ ] **Step 3: Make the smallest consumer changes**

In `components/lab/Logo.tsx`, import `HospitalLogo` and replace only its direct hospital-logo image block with:

```tsx
<HospitalLogo height={size} preload />
```

Leave the CBH Lab `Image` unchanged.

In `app/login/page.tsx`, import `HospitalLogo` and replace only the first hospital-logo `Image` with:

```tsx
<HospitalLogo height={64} preload />
```

Keep both existing CBH Lab `Image` usages unchanged.

In `components/layout/PublicNav.tsx`, replace the mobile square-sizing selector with separate rules:

```css
.pub-logo-link img { height: 48px !important; }
.pub-logo-link img:first-child { width: 72px !important; }
.pub-logo-link img:nth-child(2) { width: 48px !important; }
```

- [ ] **Step 4: Run the focused regression test to verify it passes**

Run: `npx tsx scripts/hospital-logo.test.ts`

Expected: `hospital logo component tests passed` with exit code 0.

- [ ] **Step 5: Run integration-level checks**

Run:

```bash
npx tsx scripts/hospital-logo.test.ts
npx tsc --noEmit
npm run build
```

Expected: every command exits with code 0; the focused test prints `hospital logo component tests passed`, type checking reports no errors, and the production build completes successfully.

- [ ] **Step 6: Manually verify rendered pages**

Run `npm run dev`, then inspect at desktop and below 420px:

- `/`: header hospital logo is wider than tall, sharp, and not cropped beside the circular MT logo.
- `/`: footer uses the same treatment.
- `/login`: hospital logo is sharp, aligned with the 64px MT logo, and undistorted.

- [ ] **Step 7: Commit the consumer migration**

```bash
git add components/lab/Logo.tsx app/login/page.tsx components/layout/PublicNav.tsx scripts/hospital-logo.test.ts
git commit -m "fix: render hospital logo sharply everywhere"
```
