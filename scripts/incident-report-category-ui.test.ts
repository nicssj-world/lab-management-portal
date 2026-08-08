import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(process.cwd(), 'components', 'risk', 'IncidentReportForm.tsx'),
  'utf8',
).replace(/\r\n/g, '\n')

assert.match(source, /INCIDENT_CATEGORY_GROUPS/)
assert.match(source, /incidentCategoryGroupFor/)
assert.match(source, /aria-expanded=/)
assert.match(source, /aria-controls=/)
assert.match(source, /data-event-category-trigger/)
assert.match(source, /type="radio"/)
assert.match(source, /name="event_category"/)
assert.match(source, /setOpenGroups/)
assert.match(source, /openGroupsForIncidentCategory/)
assert.match(source, /setOpenGroups\(openGroupsForIncidentCategory\(/)
assert.doesNotMatch(source, /<select[^>]*id="event_category"/)

console.log('incident report category UI contract passed')
