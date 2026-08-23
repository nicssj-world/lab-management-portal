import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const hub = readFileSync(join(root, 'components/chemical-safety/ChemicalSafetyHubClient.tsx'), 'utf8')
const sdsManagement = readFileSync(join(root, 'components/chemical-safety/SdsManagementClient.tsx'), 'utf8')
const summary = readFileSync(join(root, 'lib/chemical-safety/publication-summary.ts'), 'utf8')

assert.match(hub, /เผยแพร่ทั้งงาน/)
assert.match(hub, /publicationButtonLabel/)
assert.match(hub, /publicationHelperText/)
assert.match(summary, /อัปเดตการเผยแพร่/)
assert.match(summary, /มีการเปลี่ยนแปลงรอเผยแพร่/)
assert.doesNotMatch(hub, /เผยแพร่การเปลี่ยนแปลง/)
assert.doesNotMatch(sdsManagement, /เผยแพร่การเปลี่ยนแปลง/)

console.log('chemical publication copy contract passed')
