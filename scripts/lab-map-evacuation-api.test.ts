import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const root = process.cwd()
const routePaths = [
  'app/api/admin/lab-map/evacuation/route.ts',
  'app/api/admin/lab-map/evacuation/plans/route.ts',
  'app/api/admin/lab-map/evacuation/plans/[id]/route.ts',
  'app/api/admin/lab-map/evacuation/drills/route.ts',
  'app/api/admin/lab-map/evacuation/drills/[id]/route.ts',
]

for (const relativePath of routePaths) {
  assert.equal(existsSync(`${root}/${relativePath}`), true, `${relativePath} ต้องมีอยู่จริง`)
  const source = readFileSync(`${root}/${relativePath}`, 'utf8')
  assert.match(source, /requireSafety(?:Viewer|Editor|Manager)/, `${relativePath} ต้องมี guard`)
  if (relativePath !== 'app/api/admin/lab-map/evacuation/route.ts') {
    assert.match(source, /safeParse/, `${relativePath} ต้อง validate payload ก่อนเขียน`)
  }
}

const planRoute = readFileSync(`${root}/app/api/admin/lab-map/evacuation/plans/[id]/route.ts`, 'utf8')
assert.match(planRoute, /transitionEvacuationPlan/)
assert.match(planRoute, /requireSafetyManager/)
assert.match(planRoute, /actionParsed\.data\.action === 'submit' \? await requireSafetyEditor\(\)/)

const drillRoute = readFileSync(`${root}/app/api/admin/lab-map/evacuation/drills/[id]/route.ts`, 'utf8')
assert.match(drillRoute, /updateDrillSession/)

const guard = readFileSync(`${root}/lib/auth/session-guard.ts`, 'utf8')
assert.match(guard, /staff/, 'โมดูล evacuation อยู่ใต้ /staff และต้องถูกป้องกันด้วย auth proxy')

console.log('evacuation API route contract passed')
