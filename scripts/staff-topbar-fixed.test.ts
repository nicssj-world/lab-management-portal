import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const topbar = readFileSync('components/layout/StaffTopbar.tsx', 'utf8')
const shell = readFileSync('app/(protected)/layout.tsx', 'utf8')

assert.match(topbar, /const \{ collapsed, toggle, toggleMobile \} = useSidebar\(\)/, 'topbar tracks the sidebar state')
assert.match(topbar, /className=\{`staff-topbar \$\{collapsed \? 'is-sidebar-collapsed' : ''\}`\}/, 'topbar exposes its sidebar state for layout positioning')
assert.match(topbar, /position: 'fixed'/, 'topbar stays fixed while the page scrolls')

assert.match(shell, /\.staff-topbar \{ left: 248px; right: 0;[^}]*\}/, 'expanded desktop sidebar leaves room for the fixed topbar')
assert.match(shell, /\.staff-topbar\.is-sidebar-collapsed \{ left: 64px; \}/, 'collapsed desktop sidebar leaves room for the fixed topbar')
assert.match(shell, /@media \(max-width: 767px\) \{[\s\S]*?\.staff-topbar \{ left: 0; right: 0; \}/, 'mobile topbar spans the viewport')
assert.match(shell, /\.staff-topbar-spacer \{ height: 56px; flex: 0 0 56px; \}/, 'content keeps its original topbar clearance')
assert.match(shell, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.staff-topbar \{ transition: none; \}/, 'topbar movement respects reduced-motion preferences')

const topbarIndex = shell.indexOf('<StaffTopbar />')
const spacerIndex = shell.indexOf('className="staff-topbar-spacer"')
assert.ok(topbarIndex >= 0 && spacerIndex > topbarIndex, 'topbar clearance follows the fixed topbar in the shell')

console.log('staff topbar fixed layout contract passed')
