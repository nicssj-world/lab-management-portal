import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const hub = readFileSync(join(root, 'components/chemical-safety/ChemicalSafetyHubClient.tsx'), 'utf8')
const registryModal = readFileSync(join(root, 'components/chemical-safety/RegistryChangeModal.tsx'), 'utf8')
const summary = readFileSync(join(root, 'lib/chemical-safety/publication-summary.ts'), 'utf8')

assert.match(summary, /อัปเดตอัตโนมัติ/)
assert.match(registryModal, /มีผลทันที/)
assert.match(registryModal, /เผยแพร่อัตโนมัติ/)
assert.doesNotMatch(hub, /เผยแพร่ห้องเก็บสารเคมี/)

console.log('chemical room auto-publication contract passed')
