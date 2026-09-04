import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { shiftSchedulerTarget } from '../lib/shift-sso'

assert.equal(shiftSchedulerTarget({}), 'https://shift-mtcbh.vercel.app')
assert.equal(
  shiftSchedulerTarget({ SHIFT_SCHEDULER_URL: 'https://preview.example/shift/?month=2026-09#top' }),
  'https://preview.example/shift',
)
assert.equal(
  shiftSchedulerTarget({ SHIFT_SCHEDULER_URL: 'javascript:alert(1)' }),
  'https://shift-mtcbh.vercel.app',
)
assert.equal(
  shiftSchedulerTarget({ SHIFT_SCHEDULER_URL: 'https://user:pass@preview.example' }),
  'https://shift-mtcbh.vercel.app',
)

const sidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')
const topbar = readFileSync('components/layout/StaffTopbar.tsx', 'utf8')
const protectedLayout = readFileSync('app/(protected)/layout.tsx', 'utf8')
assert.doesNotMatch(sidebar, /href: '\/auth\/shift'/, 'shift schedule is no longer a sidebar item')
assert.match(topbar, /userRole\?: string/)
assert.match(topbar, /isAdminRole/, 'the topbar keeps the Admin-only rollout')
assert.match(topbar, /href="\/auth\/shift"/)
assert.match(topbar, /ตารางเวร/)
assert.match(protectedLayout, /<StaffTopbar userRole=\{role\} \/>/, 'the shell passes the current role to the topbar')

const handoff = readFileSync('app/auth/shift/route.ts', 'utf8')
assert.match(handoff, /auth\.getUser\(\)/, 'the handoff starts from the portal session')
assert.match(handoff, /isAdminRole/, 'the handoff enforces the Admin-only rollout')
assert.match(handoff, /auth\.admin\.generateLink\(/, 'the one-time link is minted server-side')
assert.match(handoff, /type: 'magiclink'/, 'only a magic-link token is minted')
assert.match(handoff, /new URL\('\/auth\/confirm'/, 'the token is consumed by the shift app')
assert.match(handoff, /Cache-Control.*no-store/)
assert.match(handoff, /Referrer-Policy.*no-referrer/)

assert.doesNotMatch(sidebar, /บริหารสัญญา/)
assert.doesNotMatch(topbar, /บริหารสัญญา/)
assert.doesNotMatch(readFileSync('app/(protected)/staff/contracts/ContractsClient.tsx', 'utf8'), /บริหารสัญญา/)

console.log('shift navigation and SSO contract passed')
