import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('app/(protected)/staff/personnel/[id]/StaffDetailClient.tsx'), 'utf8')

assert.match(source, /filterAndSortTraining/)
assert.match(source, /setTrainingYear/)
assert.match(source, /setTrainingQuery/)
assert.match(source, /setTrainingSort/)
assert.match(source, /ค้นหาหัวข้อ ผู้จัด สถานที่ หรือหมายเหตุ/)
assert.match(source, /เรียงตามวันที่/)
