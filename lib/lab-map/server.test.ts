import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { LAB_ZONES, REQUIRED_SPACE_CODES } from './manifest'
import { buildStaffLabMapDTO, type StaffMapRepository } from './server-builder'

const repository: StaffMapRepository = {
  activeSpaceCodes: async () => REQUIRED_SPACE_CODES,
  activeZoneCodes: async () => LAB_ZONES.map((zone) => zone.code),
  liveSafetySnapshot: async () => ({
    safetyEquipment: [{ code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 433, y: 153, verified: false }],
    assemblyPoints: [{ code: 'assembly-1', nameTh: 'จุดรวมพล', exitCodes: ['exit-3a'], latitude: 13, longitude: 100, verified: true }],
  }),
}

async function main() {
  const serverSource = readFileSync('lib/lab-map/server.ts', 'utf8')
  assert.doesNotMatch(serverSource, /lab_map_person_assignments/, 'map no longer queries personnel assignments')
  assert.doesNotMatch(serverSource, /profiles/, 'map no longer reads the profile roster')

  const map = await buildStaffLabMapDTO(repository)
  assert.ok(!('people' in map), 'personnel is gone from the staff DTO')
  assert.ok(!('canEditPersonnelAssignments' in map), 'personnel edit flag is gone from the staff DTO')
  assert.ok(map.structures.length > 0, 'staff DTO carries the structural layer')
  assert.ok(map.labels.length > 0, 'staff DTO carries authored labels')
  assert.ok(map.spaces.some((space) => space.infectionClass), 'staff DTO keeps infection classes')
  assert.ok(map.safetyEquipment.length > 0, 'staff DTO carries fire safety equipment')
  assert.ok(map.assemblyPoints.length > 0, 'staff DTO carries assembly points')
  const mapWithoutEquipment = await buildStaffLabMapDTO(repository, { includeSafetyEquipment: false })
  assert.deepEqual(mapWithoutEquipment.safetyEquipment, [], 'surfaces without registry ownership receive no equipment payload')
  assert.ok(mapWithoutEquipment.assemblyPoints.length > 0, 'the main map can keep evacuation guidance without equipment')
  const mapWithoutSafetyLayers = await buildStaffLabMapDTO(repository, { includeSafetyEquipment: false, includeAssemblyPoints: false })
  assert.deepEqual(mapWithoutSafetyLayers.safetyEquipment, [], 'equipment remains absent from the equipment page base map')
  assert.deepEqual(mapWithoutSafetyLayers.assemblyPoints, [], 'equipment page base map does not carry evacuation records')
  assert.deepEqual(
    map.safetyEquipment.find((item) => item.code === 'extinguisher-2'),
    { code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 433, y: 153, verified: false },
    'working staff map uses the current safety registry position when no release exists',
  )
  assert.ok(map.stations.some((station) => station.kind === 'checkpoint'), 'staff DTO includes checkpoint stations, not just installation points')
  assert.equal(
    map.stations.find((station) => station.code === map.stationCode)?.kind,
    'installation',
    'the default station is an installation point, not a checkpoint',
  )

  await assert.rejects(
    () => buildStaffLabMapDTO({ ...repository, activeSpaceCodes: async () => [] }),
    /seed drift/,
  )
  console.log('lab map staff DTO tests passed')
}

main().catch((error) => { console.error(error); process.exit(1) })
