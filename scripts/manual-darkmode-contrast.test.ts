import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const shell = readFileSync('app/(public)/manual/ManualShell.tsx', 'utf8')
const home = readFileSync('app/(public)/manual/sections/ManualHome.tsx', 'utf8')
const micro = readFileSync('app/(public)/manual/sections/ManualMicrobiology.tsx', 'utf8')

const manualContentRule = shell.match(/\.manual-content\s*\{[\s\S]*?\}/)?.[0] ?? ''

assert.equal(
  manualContentRule.replace(/\s+/g, ' ').trim(),
  '.manual-content { min-width: 0; }',
  'manual shell should not force the whole manual content area into a light theme',
)

assert.match(home, /\[data-theme="dark"\]\s+\.manual-home\s*\{/, 'manual overview should have a scoped dark-mode surface override')
assert.match(home, /\[data-theme="dark"\]\s+\.manual-stat-card/, 'manual overview cards should have scoped dark-mode card overrides')
assert.match(home, /\[data-theme="dark"\]\s+\.manual-section-link/, 'manual overview section links should have scoped dark-mode card overrides')
assert.match(home, /\[data-theme="dark"\]\s+\.manual-pdf-card/, 'manual overview PDF card should have scoped dark-mode card overrides')

assert.match(micro, /\[data-theme="dark"\]\s+\.micro-hero\s*\{/, 'microbiology hero should have a scoped dark-mode surface override')
assert.match(micro, /\[data-theme="dark"\]\s+\.micro-stat\s*\{/, 'microbiology stat cards should have scoped dark-mode card overrides')
assert.match(micro, /\[data-theme="dark"\]\s+\.micro-label-card\s*\{/, 'microbiology label cards should have scoped dark-mode card overrides')

console.log('manual dark-mode contrast tests passed')
