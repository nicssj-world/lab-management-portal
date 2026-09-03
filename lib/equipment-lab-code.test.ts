import assert from 'node:assert/strict'
import {
  getLabCodeInfo,
  LAB_CODE_DEPARTMENTS,
  LAB_CODE_FORMAT,
  normalizeLabCode,
  parseLabCode,
  parseLabDepartmentCode,
} from './equipment-lab-code'

assert.equal(LAB_CODE_FORMAT, 'LAB-XX-NN-XXX', 'the LAB code format must document its three segments')

assert.equal(
  LAB_CODE_DEPARTMENTS.MT,
  'สำนักงานกลุ่มงานเทคนิคการแพทย์',
  'MT must be the department code for the medical technology group office',
)

assert.deepEqual(
  parseLabCode('lab-mt-07-001'),
  { departmentCode: 'MT', classificationCode: '07' },
  'department and classification codes must be parsed case-insensitively',
)

assert.equal(parseLabDepartmentCode('LAB-mt'), 'MT', 'the department segment can be read before the other segments are entered')
assert.equal(normalizeLabCode(' lab-mt - 07 - 001 '), 'LAB-MT-07-001', 'recognized LAB codes must be normalized before saving')
assert.equal(normalizeLabCode('legacy-equipment-01'), 'legacy-equipment-01', 'legacy non-LAB identifiers must remain unchanged')

assert.deepEqual(
  getLabCodeInfo('LAB-MT'),
  { department: LAB_CODE_DEPARTMENTS.MT, classification: null },
  'a department-only LAB code must still bind the equipment to its department',
)

assert.deepEqual(
  getLabCodeInfo(' lab-mt - 07 - 001 '),
  { department: LAB_CODE_DEPARTMENTS.MT, classification: 'Refrigerator' },
  'code-derived defaults must also work for legacy spacing/casing variants',
)

assert.deepEqual(
  getLabCodeInfo('LAB-MT-07-001'),
  {
    department: 'สำนักงานกลุ่มงานเทคนิคการแพทย์',
    classification: 'Refrigerator',
  },
  'an MT equipment code must populate the office department while preserving the classification rule',
)

console.log('equipment-lab-code: all checks passed')
