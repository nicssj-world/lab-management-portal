import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('app/(public)/page.tsx', 'utf8')
const lineCard = readFileSync('components/public/LineQrCard.tsx', 'utf8')

const actionsStart = source.indexOf('className="public-hero-actions"')
const actionsEnd = source.indexOf('{/* LINE QR card', actionsStart)
const primaryActions = actionsStart >= 0 && actionsEnd >= 0 ? source.slice(actionsStart, actionsEnd) : ''

assert.match(primaryActions, /<PublicHeroSearch \/>/, 'hero primary action row should contain the catalog quick search')
assert.doesNotMatch(primaryActions, /href="\/manual"/, 'manual link should not sit beside the primary catalog search')

const secondaryStart = source.indexOf('className="public-hero-secondary-links"')
const secondaryEnd = source.indexOf('<div className="public-photo-stack"', secondaryStart)
const secondaryActions = secondaryStart >= 0 && secondaryEnd >= 0 ? source.slice(secondaryStart, secondaryEnd) : ''

assert.match(secondaryActions, /<LineQrCard \/>/, 'secondary action area should keep the LINE card')
assert.match(secondaryActions, /href="\/manual"/, 'secondary action area should include the laboratory manual link')
assert.match(secondaryActions, /className="manual-card"/, 'manual link should be rendered as a secondary card')
assert.doesNotMatch(
  lineCard,
  /สอบถามข้อมูลรายการตรวจผ่าน LINE/,
  'LINE card should not imply that a real person answers questions in chat',
)
assert.match(
  lineCard,
  /ระบบตอบข้อมูลอัตโนมัติผ่าน LINE/,
  'LINE card should clearly describe the account as an automated information channel',
)
assert.doesNotMatch(
  lineCard,
  /line\.me/,
  'LINE card must not depend on line.me — the QR is self-hosted and opens in an in-page lightbox',
)
assert.match(
  lineCard,
  /src="\/line-qr\.png"/,
  'LINE card should render the self-hosted QR image',
)
const mobileHeroCssStart = source.indexOf('@media (max-width: 900px)')
const mobileHeroCssEnd = source.indexOf('@media (max-width: 520px)', mobileHeroCssStart)
const mobileHeroCss = mobileHeroCssStart >= 0 && mobileHeroCssEnd >= 0
  ? source.slice(mobileHeroCssStart, mobileHeroCssEnd)
  : ''
assert.match(
  mobileHeroCss,
  /\.public-hero-actions,\s*\.public-hero-secondary-links\s*\{[\s\S]*?margin-inline:\s*auto;/,
  'mobile hero search and secondary cards should share equal gutters and be centered',
)
assert.doesNotMatch(
  lineCard,
  /ไม่มีเจ้าหน้าที่ตอบแชทสด/,
  'LINE card should not use negative live-chat wording in the compact hero card',
)

console.log('public home hero action tests passed')
