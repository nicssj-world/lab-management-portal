import assert from 'node:assert/strict'
import { getPairedHospitalLogoOffset } from '../lib/logo-layout'

assert.equal(getPairedHospitalLogoOffset(64), -20, '64px paired logos should remove 20px of transparent right padding')
assert.equal(getPairedHospitalLogoOffset(56), -17.5, 'the visual correction should scale with logo height')
assert.equal(getPairedHospitalLogoOffset(32), -10, 'small paired logos should retain the same visual proportion')

console.log('Logo pair spacing tests passed')
