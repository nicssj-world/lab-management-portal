import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const pending = readFileSync('app/(protected)/staff/documents/pending/PendingClient.tsx', 'utf8')

assert.match(pending, /showChangeDescription\?: boolean/)
assert.match(pending, /showChangeDescription=\{false\}/)
