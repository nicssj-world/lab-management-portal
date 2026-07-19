import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

const icon = read('components/ui/Icon.tsx')
assert.ok(icon.includes('aria-hidden="true"'), 'decorative icons are hidden from assistive technology')
assert.ok(icon.includes('focusable="false"'), 'SVG icons cannot steal keyboard focus')

const topbar = read('components/layout/StaffTopbar.tsx')
for (const label of ['เปิดหรือย่อเมนูหลัก', 'เปลี่ยนภาษา', 'เปลี่ยนธีม', 'กลับหน้าเว็บไซต์']) {
  assert.ok(topbar.includes(`aria-label="${label}"`), `labels the ${label} control`)
}

const sidebar = read('components/layout/StaffSidebar.tsx')
assert.ok(sidebar.includes('aria-label="ออกจากระบบ"'), 'labels the icon-only logout button')

for (const path of ['components/ui/ModuleSubnav.tsx', 'components/ui/ViewTabs.tsx', 'components/ui/FilterChips.tsx']) {
  const source = read(path)
  assert.match(source, /min-height:44px/, `${path} defines a usable touch target`)
  assert.doesNotMatch(source, /min-height:(?:[0-3]\d|4[0-3])px/, `${path} does not shrink compact controls below 44px`)
  assert.ok(source.includes('outline:3px'), `${path} provides a visible keyboard focus ring`)
  assert.ok(source.includes('prefers-reduced-motion'), `${path} respects reduced motion`)
}

console.log('navigation accessibility tests passed')
