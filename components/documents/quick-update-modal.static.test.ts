import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/documents/QuickUpdateModal.tsx', 'utf8')

const guardIndex = source.indexOf('if (publishDescriptionRequired && !note.trim())')
const busyIndex = source.indexOf('setBusy(true)')
assert.ok(guardIndex >= 0, 'Quick Update should validate required QP/WI detail before starting upload')
assert.ok(guardIndex < busyIndex, 'Quick Update should validate required QP/WI detail before setting busy')
assert.match(source, /const changeDescription = note\.trim\(\)/)
assert.match(source, /body: JSON\.stringify\(\{ description: changeDescription \}\)/)
assert.match(source, /body: JSON\.stringify\(\{ status: targetStatus \}\)/)
assert.match(source, /draftId = null \/\/ preserve the confirmed draft for detail recovery/)
assert.doesNotMatch(source, /body: JSON\.stringify\(\{ status: targetStatus, description:/)
