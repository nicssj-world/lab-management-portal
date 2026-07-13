import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')

assert.match(sidebar, /staff-nav-badge-trailing/, 'single navigation badges must reserve the same trailing chevron space as grouped navigation badges')
assert.match(sidebar, /span style=\{\{ flex: 1, minWidth: 0, [^}]*color: 'var\(--ink\)'/, 'navigation labels must be allowed to shrink so badges remain in one column')

console.log('staff sidebar tests passed')
