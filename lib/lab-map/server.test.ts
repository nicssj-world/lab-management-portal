import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LAB_ZONES, REQUIRED_SPACE_CODES } from './manifest'
import { buildStaffLabMapDTO, type StaffMapRepository } from './server-builder'

let personnelReads = 0
const repository: StaffMapRepository = {
  activeSpaceCodes: async () => REQUIRED_SPACE_CODES,
  activeZoneCodes: async () => LAB_ZONES.map((zone) => zone.code),
  assignments: async () => {
    personnelReads += 1
    return [{
      assignmentId: 'a1', profileId: 'p1', name: 'คนทดสอบ', department: 'งานเคมีคลินิก',
      assignmentType: 'primary', spaceCode: 'central-lab-left', zoneCode: null,
    }]
  },
  activeProfiles: async () => {
    personnelReads += 1
    return [
      { profileId: 'p1', name: 'คนทดสอบ', department: 'งานเคมีคลินิก' },
      { profileId: 'p2', name: 'ยังไม่กำหนด', department: null },
    ]
  },
}

async function main() {
  const serverSource = readFileSync('lib/lab-map/server.ts', 'utf8')
  assert.ok(serverSource.includes(".select('id,name,dept')"), 'profile roster uses the real profiles.dept column')
  assert.ok(serverSource.includes('id,name,dept), space:'), 'assignment relation uses the real profiles.dept column')
  assert.ok(!serverSource.includes('id,name,department'), 'profile queries must not reference a nonexistent department column')

  const geometryOnly = await buildStaffLabMapDTO({ บุคลากร: 'none' }, repository)
  assert.ok(!('people' in geometryOnly), 'personnel property is omitted without permission')
  assert.equal(personnelReads, 0, 'personnel repository is never queried without permission')

  const viewer = await buildStaffLabMapDTO({ บุคลากร: 'view' }, repository)
  assert.equal(viewer.canEditPersonnelAssignments, false)
  assert.equal(viewer.people?.[0]?.name, 'คนทดสอบ')
  assert.deepEqual(viewer.unassignedPeople?.map((person) => person.profileId), ['p2'])

  const editor = await buildStaffLabMapDTO({ บุคลากร: 'edit' }, repository)
  assert.equal(editor.canEditPersonnelAssignments, true)

  await assert.rejects(
    () => buildStaffLabMapDTO({ บุคลากร: 'view' }, { ...repository, activeSpaceCodes: async () => [] }),
    /seed drift/,
  )
  console.log('lab map staff DTO tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
