import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

const transitions = read('lib/documents/transitions.ts')
const pendingPage = read('app/(protected)/staff/documents/pending/page.tsx')
const pendingData = read('lib/documents/pending.ts')
const pendingClient = read('app/(protected)/staff/documents/pending/PendingClient.tsx')
const sidebar = read('components/layout/StaffSidebar.tsx')

assert.match(transitions, /export function canAccessPendingApproval/)
assert.match(pendingPage, /if \(!canAccessPendingApproval\(role, docRole\)\)/)
assert.match(sidebar, /role: \['Admin', 'Manager', 'Document Controller', 'Quality Manager', 'Laboratory Director'\], docRole: \['Document Controller', 'Reviewer', 'Quality Manager', 'Laboratory Director'\]/)
assert.match(pendingPage, /d\.status === 'Draft' && \(d\.hasWordUrl \|\| d\.hasOfficialPdf\)/)
assert.match(pendingData, /d\.status === 'Draft' && \(d\.hasWordUrl \|\| d\.hasOfficialPdf\)/)
assert.match(pendingClient, /function bucketForStatus\(status: DocumentRevisionDraft\['status'\], hasWordUrl: boolean, hasOfficialFile: boolean\)/)

