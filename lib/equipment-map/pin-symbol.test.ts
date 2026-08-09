import assert from 'node:assert/strict'
import { getEquipmentPinSymbol } from './pin-symbol'

function main() {
  assert.equal(getEquipmentPinSymbol('07', 'Anything').kind, 'refrigerator')
  assert.equal(getEquipmentPinSymbol('02', 'Anything').kind, 'centrifuge')
  assert.equal(getEquipmentPinSymbol('12', 'Anything').kind, 'microscope')
  assert.equal(getEquipmentPinSymbol('11', 'Anything').kind, 'bsc')

  assert.equal(getEquipmentPinSymbol(null, 'Centrifuge, table top').kind, 'centrifuge')
  assert.equal(getEquipmentPinSymbol('99', 'Centrifuge, table top').kind, 'code', 'classification must take precedence over a name fallback')
  assert.deepEqual(getEquipmentPinSymbol(null, 'Custom equipment'), { kind: 'code', code: 'EQ', label: 'อุปกรณ์ทั่วไป' })

  assert.equal(getEquipmentPinSymbol('Analyzer', 'Anything').code, 'AN')
  assert.equal(getEquipmentPinSymbol('Analyzer (Rental)', 'Anything').code, 'AN')

  console.log('equipment map pin symbol resolver passed')
}

main()
