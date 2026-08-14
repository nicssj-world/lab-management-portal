import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const layoutPath = 'app/layout.tsx'
const logoPath = 'public/images/cbh-lab-logo-v3.png'

assert.ok(existsSync(layoutPath), 'the root layout must define the site metadata')
assert.ok(existsSync(logoPath), 'the current CBH Lab logo must be available to shared pages')

const layout = readFileSync(layoutPath, 'utf8')

assert.match(layout, /metadataBase:\s*new URL\(/, 'share metadata must have an absolute metadata base URL')
assert.match(
  layout,
  /openGraph:\s*\{[\s\S]*?images:\s*\[[\s\S]*?url:\s*['"]\/images\/cbh-lab-logo-v3\.png['"]/,
  'LINE share metadata must use the current CBH Lab logo as its Open Graph image',
)

console.log('share metadata tests passed')
