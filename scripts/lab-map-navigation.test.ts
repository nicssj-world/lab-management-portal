import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { isProtectedPath } from '../lib/auth/session-guard'

const page = readFileSync('app/(protected)/staff/lab-map/page.tsx', 'utf8')
const client = readFileSync('components/lab-map/StaffLabMap.tsx', 'utf8')
const sidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')
const topbar = readFileSync('components/layout/StaffTopbar.tsx', 'utf8')

assert.ok(isProtectedPath('/staff/lab-map'))
assert.ok(!isProtectedPath('/lab-map/office'))

assert.match(page, /await createClient\(\)/)
assert.match(page, /auth\.getUser\(\)/)
assert.match(page, /redirect\('\/login'\)/)
assert.match(page, /LAB_SPACES/)
assert.match(page, /<StaffLabMap/)

assert.match(client, /^'use client'/)
assert.match(client, /LabMapShell/)
assert.doesNotMatch(client, /supabase/)
assert.doesNotMatch(client, /lab-map\/manifest/)

assert.match(sidebar, /href: '\/staff\/lab-map'/)
assert.match(topbar, /'\/staff\/lab-map'/)

console.log('lab map staff navigation passed')
