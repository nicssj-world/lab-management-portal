// Static source-shape checks only. These do not claim browser/DOM behavioral coverage.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const controller = readFileSync('components/documents/useDocumentSetUpload.ts', 'utf8')
const modal = readFileSync('components/documents/DocumentSetUploadModal.tsx', 'utf8')
const phases = readFileSync('components/documents/DocumentSetUploadPhases.tsx', 'utf8')

assert.match(controller, /for \(const timer of duplicateTimers\.current\.values\(\)\) clearTimeout\(timer\)/)
assert.match(controller, /for \(const controller of duplicateRequests\.current\.values\(\)\) controller\.abort\(\)/)
assert.match(modal, /document\.addEventListener\('keydown', onDocumentKeyDown, true\)/)
assert.match(modal, /document\.removeEventListener\('keydown', onDocumentKeyDown, true\)/)
assert.match(modal, /previousFocus\?\.focus\(\)/)
assert.match(modal, /useDocumentSetUpload/)
assert.match(phases, /function IntakePhase/)
assert.doesNotMatch(modal, /function IntakePhase|function DocumentSetUploadRow/)
