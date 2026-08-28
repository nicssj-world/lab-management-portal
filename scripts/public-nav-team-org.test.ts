import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const nav = readFileSync('components/layout/PublicNav.tsx', 'utf8')
const preview = readFileSync('components/personnel/PersonPreview.tsx', 'utf8')
const page = readFileSync('app/(public)/staff/personnel/team-org/page.tsx', 'utf8')

assert.match(nav, /const ORGANIZATION_ITEMS = \[/)
assert.match(nav, /href: ['"]\/staff\/personnel\/team-org['"]/)
assert.match(nav, /children: ORGANIZATION_ITEMS/)
assert.match(preview, /role="dialog"/)
assert.match(preview, /createPortal/)
assert.match(preview, /public-shell/)
assert.match(preview, /ขยายรูปและดูข้อมูล/)
assert.match(preview, /event\.key === 'Escape'/)
assert.match(page, /title="เจ้าหน้าที่กลุ่มงานเทคนิคการแพทย์"/)
assert.match(page, /className="team-section-title"/)
assert.match(page, /text-wrap:balance/)
assert.equal(existsSync('app/(public)/staff/personnel/team-org/page.tsx'), true)
assert.equal(existsSync('app/(protected)/staff/personnel/team-org/page.tsx'), false)

console.log('public team-org navigation contract: all assertions passed')
