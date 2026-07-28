import assert from 'node:assert/strict'
import { LAB_ACCESS_POINTS, LAB_STATIONS } from './manifest'
import { buildPublicSafetyMap, publicSafetyMapPath } from './public-safety'

const map = buildPublicSafetyMap({ stationCode: 'office', version: 'F3-2026.07.28-01' })

assert.ok(map, 'known installation stations produce a public safety map')
assert.equal(map?.version, 'F3-2026.07.28-01')
assert.equal(map?.releaseStatus, 'published')
assert.deepEqual(map?.stations.map((station) => station.code), ['office'])
assert.ok(map?.routes.length && map.routes.every((route) => route.kind === 'evacuation' && route.fromStationCode === 'office'))
assert.ok(map?.accessPoints.every((point) => point.kind === 'exit'))
assert.deepEqual(map?.accessPoints.map((point) => point.code).sort(), LAB_ACCESS_POINTS.filter((point) => point.kind === 'exit').map((point) => point.code).sort())
assert.ok(map?.structures.every((structure) => structure.kind === 'exterior-wall'))
assert.deepEqual(map?.spaces, [], 'the public QR view never sends room topology')
assert.deepEqual(map?.labels, [], 'the public QR view never sends room labels')
assert.deepEqual(map?.zones, [], 'the public QR view never sends department zones')
assert.deepEqual(map?.safetyEquipment, [], 'the public QR view never sends equipment positions')
assert.ok(map?.assemblyPoints.length, 'the public QR view retains assembly-point instructions')

assert.equal(buildPublicSafetyMap({ stationCode: 'not-a-station', version: 'F3-2026.07.28-01' }), null)
assert.equal(buildPublicSafetyMap({ stationCode: LAB_STATIONS.find((station) => station.kind === 'checkpoint')!.code, version: 'F3-2026.07.28-01' }), null)
assert.equal(publicSafetyMapPath('office'), '/lab-map/office')
assert.equal(publicSafetyMapPath('not-a-station'), null)

console.log('public QR safety map contract passed')
