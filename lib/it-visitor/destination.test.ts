import assert from 'node:assert/strict'
import { resolveVisitorDestination } from './destination'

for (const department of ['งานเคมีคลินิก', 'งานภูมิคุ้มกันวิทยาคลินิก']) {
  const result = resolveVisitorDestination(department)
  assert.equal(result?.destinationCode, 'public-central-left')
  assert.equal(result?.checkpointCode, 'fingerprint-central-left')
}

for (const department of ['งานโลหิตวิทยาคลินิก', 'งานจุลทรรศนศาสตร์คลินิก']) {
  const result = resolveVisitorDestination(department)
  assert.equal(result?.destinationCode, 'public-central-right')
  assert.equal(result?.checkpointCode, 'fingerprint-central-right')
}

assert.equal(resolveVisitorDestination('งานอณูชีววิทยา')?.checkpointCode, 'fingerprint-molecular')
assert.equal(resolveVisitorDestination('งานจุลชีววิทยา')?.checkpointCode, 'fingerprint-microbiology')
assert.equal(resolveVisitorDestination('งานคลังเลือด')?.checkpointCode, 'fingerprint-blood-bank')
assert.equal(
  resolveVisitorDestination('งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ')?.checkpointCode,
  'fingerprint-special-testing',
)
assert.equal(resolveVisitorDestination('สำนักงานกลุ่มงานเทคนิคการแพทย์')?.checkpointCode, 'fingerprint-office')

for (const unmapped of [
  'งานบริการผู้ป่วยนอก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'อื่น ๆ',
  'free text',
  '',
]) {
  assert.equal(resolveVisitorDestination(unmapped), null)
}

for (const department of [
  'งานเคมีคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานอณูชีววิทยา',
  'งานจุลชีววิทยา',
  'งานคลังเลือด',
]) {
  const result = resolveVisitorDestination(department)
  assert.ok(result?.checkpointCode.startsWith('fingerprint-'))
  assert.ok(result && result.directionsTh.length > 0)
}

console.log('visitor destination mappings passed')
