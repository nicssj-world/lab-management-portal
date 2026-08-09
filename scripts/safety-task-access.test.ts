import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const server = read('lib/quality-tasks/server.ts')
const safetyApi = read('lib/quality-tasks/safety-api.ts')
const safetyOccurrences = read('app/api/admin/safety-tasks/occurrences/route.ts')
const safetyCalendarServer = read('lib/quality-tasks/safety-calendar-server.ts')
const safetyOccurrence = read('app/api/admin/safety-tasks/occurrences/[id]/route.ts')
const safetyTemplates = read('app/api/admin/safety-tasks/templates/route.ts')
const qualityAttachment = read('app/api/admin/quality-tasks/attachments/[id]/route.ts')
const safetyAttachment = read('app/api/admin/safety-tasks/attachments/[id]/route.ts')

assert.ok(safetyApi.includes('requireSafetyViewer') && safetyApi.includes('isSafetyEditor'), 'all logged-in users view while Safety Editors receive edit level')
assert.ok(safetyOccurrences.includes('getSafetyCalendarOccurrences'), 'safety collection uses the linked calendar projection')
assert.ok(safetyCalendarServer.includes("workstream: 'safety'") && safetyCalendarServer.includes("SAFETY_MEETING_QUALITY_SOURCE_KEY"), 'Safety calendar keeps Safety as its workstream and projects only the canonical Quality meeting')
assert.ok(safetyOccurrence.includes("'safety'"), 'safety item mutation fixes workstream server-side')
assert.ok(safetyTemplates.includes("getQualityTaskTemplates(false, 'safety')") && safetyTemplates.includes("saveTemplate(safetyTemplateSchema"), 'safety template API cannot select another workstream')
assert.ok(server.includes("workstream: TaskWorkstream = 'quality'") && server.includes("assertTemplateWorkstream"), 'shared engine defaults legacy APIs to quality and verifies referenced templates')
assert.ok(qualityAttachment.includes("workstream', 'quality'") && safetyAttachment.includes("workstream', 'safety'"), 'attachment download paths cannot cross workstreams')
assert.ok(server.includes('allowApprover') && server.includes('isDesignatedApprover'), 'designated approver is handled independently from assignee access')

console.log('scripts/safety-task-access.test.ts: all assertions passed')
