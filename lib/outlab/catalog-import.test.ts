import assert from 'node:assert/strict'
import { buildCatalogServiceImport, selectNHealthCodes } from './catalog-import'

const codeRows = [
  { ephisCode: '97069', nHealthCode: 'C469', sheetName: 'สรุปราคา', rowNumber: 227 },
  { ephisCode: '97069', nHealthCode: 'K180', sheetName: 'ราคาสัญญา', rowNumber: 298 },
  { ephisCode: '92000', nHealthCode: '', sheetName: 'สรุปราคา', rowNumber: 4 },
  { ephisCode: '92000', nHealthCode: 'S195', sheetName: 'ราคาสัญญา', rowNumber: 12 },
]

const codes = selectNHealthCodes(codeRows)
assert.equal(codes.get('97069'), 'C469', 'สรุปราคามีลำดับความสำคัญเมื่อรหัสซ้ำต่างกัน')
assert.equal(codes.get('92000'), 'S195', 'ต้องใช้รหัสจากชีตถัดไปเมื่อชีตสรุปราคาไม่มีค่า')

const services = buildCatalogServiceImport([
  {
    id: 1, code: '97069', th: 'Factor XIII', method: 'Urea test', tube: 'Sodium citrate (ฟ้า)', volume: '2-3 mL',
    transport_condition: 'แช่เย็น', tat: null, tat_hours: null, tat_minutes: '13 วันทำการ', price: 110,
  },
  {
    id: 2, code: '90000', th: 'ไม่มีรหัสภายนอก', method: null, tube: null, volume: null,
    transport_condition: null, tat: null, tat_hours: 48, tat_minutes: null, price: null,
  },
], codes)

assert.deepEqual(services, [
  {
    test_id: 1, test_name_snapshot: 'Factor XIII', external_code: 'C469', method: 'Urea test', specimen: 'Sodium citrate (ฟ้า) · 2-3 mL',
    transport_condition: 'แช่เย็น', tat_text: '13 วันทำการ', price: 110, active: true, is_primary: false,
  },
  {
    test_id: 2, test_name_snapshot: 'ไม่มีรหัสภายนอก', external_code: null, method: null, specimen: null,
    transport_condition: null, tat_text: '48 ชั่วโมง', price: null, active: true, is_primary: false,
  },
])

console.log('lib/outlab/catalog-import.test.ts: all assertions passed')
