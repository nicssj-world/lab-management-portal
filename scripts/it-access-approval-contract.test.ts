import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const page = readFileSync('app/(protected)/staff/it/access/page.tsx', 'utf8')
const route = readFileSync('app/api/admin/it-access/reviews/[id]/approve/route.ts', 'utf8')

test('the IT access page loads dept_role for its approval decision', () => {
  assert.match(page, /select\('role, doc_role, dept_role'\)/)
  assert.match(page, /canApproveItReview\([\s\S]*?dept_role:/)
})

test('approval requires view access rather than general IT edit access', () => {
  assert.match(route, /requireIt\('view'\)/)
})
