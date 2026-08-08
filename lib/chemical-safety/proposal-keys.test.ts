import assert from 'node:assert/strict'
import { camelProposal, snakeProposal } from './proposal-keys'

const camel = {
  ghsHazardClasses: [
    { classTh: 'สารกัดกร่อน', classEn: 'Corrosive' },
  ],
  nested: [{ receivedOn: '2026-08-09' }],
}

assert.deepEqual(snakeProposal(camel), {
  ghs_hazard_classes: [
    { class_th: 'สารกัดกร่อน', class_en: 'Corrosive' },
  ],
  nested: [{ received_on: '2026-08-09' }],
})

assert.deepEqual(camelProposal({
  ghs_hazard_classes: [
    { class_th: 'สารกัดกร่อน', class_en: 'Corrosive' },
  ],
}), {
  ghsHazardClasses: [
    { classTh: 'สารกัดกร่อน', classEn: 'Corrosive' },
  ],
})

console.log('chemical proposal key conversion: ok')
