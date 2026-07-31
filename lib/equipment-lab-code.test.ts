import assert from 'node:assert/strict'
import { getLabCodeInfo, LAB_CODE_DEPARTMENTS, parseLabCode } from './equipment-lab-code'

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

assert.deepEqual(
  getLabCodeInfo('LAB-MT-07-001'),
  {
    department: 'สำนักงานกลุ่มงานเทคนิคการแพทย์',
    classification: 'Refrigerator',
  },
  'an MT equipment code must populate the office department while preserving the classification rule',
)

console.log('equipment-lab-code: all checks passed')
