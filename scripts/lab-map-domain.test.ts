import assert from 'node:assert/strict'
import {
  LAB_ACCESS_POINTS,
  LAB_ROUTE_PRESETS,
  LAB_SPACES,
  LAB_STATIONS,
  LAB_ZONES,
  resolveRoutePreset,
} from '../lib/lab-map/manifest'
import {
  PUBLIC_LAB_ROUTES,
  PUBLIC_LAB_SPACES,
} from '../lib/lab-map/public-manifest'
import { validateLabMapManifest } from '../lib/lab-map/validate'

assert.deepEqual(validateLabMapManifest(), [])
assert.equal(new Set(LAB_SPACES.map((space) => space.code)).size, LAB_SPACES.length)
assert.equal(
  LAB_ACCESS_POINTS.find((point) => point.code === 'door-electrical-control')?.status,
  'permanently_locked',
)

const storageZone = LAB_ZONES.find((zone) => zone.code === 'storage-zone')
assert.ok(storageZone?.spaceCodes.includes('cold-material-reagent-store'))
assert.ok(storageZone?.spaceCodes.includes('material-store'))
assert.ok(storageZone?.spaceCodes.includes('material-reagent-store'))

const centralLeft = LAB_SPACES.find((space) => space.code === 'central-lab-left')
assert.deepEqual(centralLeft?.workUnits, ['งานเคมีคลินิก', 'งานภูมิคุ้มกันวิทยาคลินิก'])
const centralRight = LAB_SPACES.find((space) => space.code === 'central-lab-right')
assert.deepEqual(centralRight?.workUnits, ['งานโลหิตวิทยาคลินิก', 'งานจุลทรรศนศาสตร์คลินิก'])

for (const code of ['bsl2-enhance', 'pcr-room']) {
  assert.deepEqual(
    LAB_SPACES.find((space) => space.code === code)?.workUnits,
    ['งานจุลชีววิทยา'],
  )
}

assert.ok(LAB_ROUTE_PRESETS.every((route) => !route.pointCodes.includes('door-electrical-control')))
assert.ok(
  LAB_STATIONS.every((station) =>
    LAB_ROUTE_PRESETS.some(
      (route) => route.kind === 'evacuation' && route.fromStationCode === station.code,
    ),
  ),
)
assert.ok(
  LAB_ROUTE_PRESETS.filter((route) => route.kind === 'visitor').every((route) => {
    const endpoint = LAB_ACCESS_POINTS.find((point) => point.code === route.destinationCode)
    return endpoint?.kind === 'fingerprint'
  }),
)

assert.equal(
  resolveRoutePreset({
    kind: 'visitor',
    stationCode: 'office',
    destinationCode: 'fingerprint-central-left',
  })?.code,
  'visitor-office-central-left',
)
assert.equal(
  resolveRoutePreset({
    kind: 'evacuation',
    stationCode: 'unknown',
    destinationCode: 'exit-3a',
  }),
  null,
)

const publicPayload = JSON.stringify({ spaces: PUBLIC_LAB_SPACES, routes: PUBLIC_LAB_ROUTES })
assert.doesNotMatch(
  publicPayload,
  /BSL2|PCR|infectious|infectionClass|door-electrical-control|ห้องวินิจฉัยเชื้อ/i,
)
assert.ok(
  PUBLIC_LAB_ROUTES.filter((route) => route.kind === 'visitor').every((route) =>
    route.destinationCode.startsWith('fingerprint-'),
  ),
)

console.log('lab map domain tests passed')
