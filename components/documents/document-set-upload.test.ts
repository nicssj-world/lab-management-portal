import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const controller = readFileSync('components/documents/useDocumentSetUpload.ts', 'utf8')
const modal = readFileSync('components/documents/DocumentSetUploadModal.tsx', 'utf8')
const phases = readFileSync('components/documents/DocumentSetUploadPhases.tsx', 'utf8')

assert.match(controller, /if \(entry\.uploaded\)[\s\S]*return entry\.uploaded/, 'retry must reuse an already uploaded R2 key')
assert.match(controller, /uploaded: uploadedById\.get\(entry\.id\) \?\? entry\.uploaded/, 'ambiguous POST failures must retain prepared upload keys')
assert.match(controller, /entries\.filter\(\(entry\) => entry\.submitStatus === 'failed'\)/, 'retry must select only failed entries')

assert.match(controller, /for \(const timer of duplicateTimers\.current\.values\(\)\) clearTimeout\(timer\)/, 'unmount must clear all duplicate timers')
assert.match(controller, /for \(const controller of duplicateRequests\.current\.values\(\)\) controller\.abort\(\)/, 'unmount must abort all duplicate requests')

assert.match(modal, /const previousFocus = document\.activeElement/, 'modal must capture prior focus')
assert.match(modal, /initialFocusRef\.current\?\.focus\(\)/, 'modal must focus an internal control')
assert.match(modal, /document\.addEventListener\('keydown', onDocumentKeyDown, true\)/, 'focus trap must use a capture listener independent of bubbling')
assert.match(modal, /document\.removeEventListener\('keydown', onDocumentKeyDown, true\)/, 'focus listener must be removed on unmount')
assert.match(modal, /previousFocus\?\.focus\(\)/, 'modal must restore prior focus')
assert.match(modal, /event\.key === 'Escape'/, 'modal must handle Escape')
assert.match(modal, /event\.key !== 'Tab'/, 'modal must trap Tab and Shift+Tab')

assert.match(modal, /useDocumentSetUpload/, 'public modal must delegate workflow state to its controller hook')
assert.match(phases, /function IntakePhase/, 'phase rendering must be a module-level component')
assert.doesNotMatch(modal, /function IntakePhase|function DocumentSetUploadRow/, 'row and phase components must not be nested in the modal')
