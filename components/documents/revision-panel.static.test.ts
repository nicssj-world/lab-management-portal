import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const panel = readFileSync('components/documents/RevisionPanel.tsx', 'utf8')
const pending = readFileSync('app/(protected)/staff/documents/pending/PendingClient.tsx', 'utf8')

assert.match(panel, /onDraftUpdated\?: \(draft: DocumentRevisionDraft\) => void/)
assert.match(panel, /onDraftUpdated\?\.\(json as DocumentRevisionDraft\)/)
assert.match(pending, /onDraftUpdated=\{handleDraftStatusChange\}/)
