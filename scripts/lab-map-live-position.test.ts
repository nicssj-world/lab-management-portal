import assert from 'node:assert/strict'
import { mergeLiveSafetyPositions } from '../lib/lab-map/live-safety-positions'

const merged = mergeLiveSafetyPositions({
  snapshotAssets: [
    { code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 10, y: 20, verified: true },
    { code: 'retired-asset', kind: 'aed', nameTh: 'AED เก่า', x: 30, y: 40, verified: true },
  ],
  liveAssets: [
    { code: 'extinguisher-2', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 2', x: 110, y: 120, verified: true, operationalStatus: 'passed' },
    { code: 'extinguisher-3', kind: 'fire-extinguisher', nameTh: 'ถังดับเพลิง 3', x: 210, y: 220, verified: false, operationalStatus: 'unverified' },
  ],
  snapshotAssemblyPoints: [
    { code: 'assembly-1', nameTh: 'จุดรวมพลเดิม', exitCodes: ['exit-3a'], latitude: 13, longitude: 100, verified: true },
  ],
  liveAssemblyPoints: [
    { code: 'assembly-1', nameTh: 'จุดรวมพลใหม่', exitCodes: ['exit-3b'], latitude: 14, longitude: 101, verified: true },
    { code: 'assembly-2', nameTh: 'จุดใหม่ที่ยังไม่ยืนยัน', exitCodes: ['exit-3c'], latitude: 15, longitude: 102, verified: false },
  ],
})

const movedAsset = merged.safetyEquipment.find((item) => item.code === 'extinguisher-2')
assert.deepEqual(
  { x: movedAsset?.x, y: movedAsset?.y, operationalStatus: movedAsset?.operationalStatus },
  { x: 110, y: 120, operationalStatus: 'passed' },
  'a verified live asset position replaces the release snapshot position',
)
assert.equal(merged.safetyEquipment.some((item) => item.code === 'retired-asset'), false, 'retired assets are removed from the live projection')
assert.equal(merged.safetyEquipment.some((item) => item.code === 'extinguisher-3'), false, 'unverified new assets are not published into the map')

const movedAssembly = merged.assemblyPoints.find((item) => item.code === 'assembly-1')
assert.deepEqual(
  { nameTh: movedAssembly?.nameTh, exitCodes: movedAssembly?.exitCodes, latitude: movedAssembly?.latitude, longitude: movedAssembly?.longitude },
  { nameTh: 'จุดรวมพลใหม่', exitCodes: ['exit-3b'], latitude: 14, longitude: 101 },
  'a verified live assembly point replaces the release snapshot position',
)
assert.equal(merged.assemblyPoints.some((item) => item.code === 'assembly-2'), false, 'unverified new assembly points are not published into the map')

console.log('lab map live position tests passed')
