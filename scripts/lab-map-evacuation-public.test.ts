import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

assert.equal(existsSync('app/(public)/lab-map/[stationCode]/page.tsx'), true)
assert.equal(existsSync('lib/lab-map/evacuation-server.ts'), true)
const page = readFileSync('app/(public)/lab-map/[stationCode]/page.tsx', 'utf8')
const server = readFileSync('lib/lab-map/evacuation-server.ts', 'utf8')
assert.match(page, /getPublishedEvacuationGuidance/)
assert.match(page, /คำสั่งหลังออก|จุดรวมพล/)
assert.match(server, /getPublishedEvacuationGuidance/)
assert.match(server, /status.*published|published.*status/)
assert.match(server, /map_release_id/, 'public guidance must bind to a map release')
assert.match(server, /not\('effective_date',\s*'is',\s*null\)/, 'public guidance must require an effective date')
assert.match(server, /lab_map_versions[\s\S]*status.*published/, 'public guidance must fail closed when the linked map release is not published')
assert.doesNotMatch(page, /headcountResponsible|reviewedBy|approvedBy/)
console.log('evacuation public projection contract passed')
