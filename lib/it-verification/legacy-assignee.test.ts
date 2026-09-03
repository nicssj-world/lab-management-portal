import assert from 'node:assert/strict'
import test from 'node:test'
import { parseLegacyResponsibleRows, resolveLegacyAssignees } from './legacy-assignee'

const responsibleRows = [
  ['ผู้รับผิดชอบบันทึกการตรวจสอบความถูกต้องของการส่งผ่านข้อมูลในระบบสารสนเทศ'],
  [],
  ['งาน', 'ชื่อ-นามสกุล', 'ตำแหน่ง'],
  ['เคมีคลินิก', 'สุธีมนต์', 'นักเทคนิคการแพทย์'],
  ['ภูมิคุ้มกัน', 'วรรษชล', 'นักเทคนิคการแพทย์'],
  ['โลหิต', 'สิริมา', 'นักเทคนิคการแพทย์'],
  ['จุลทรรศน์', 'วรวุฒิ', 'นักเทคนิคการแพทย์'],
  ['จุุลชีววิทยา', 'นาคพรรดิ', 'นักเทคนิคการแพทย์'],
  ['อณูชีววิทยา', 'ศิริวัฒน์', 'นักเทคนิคการแพทย์'],
  ['คลังเลือด', 'ธนาวุฒิ', 'นักเทคนิคการแพทย์'],
  ['', '', 'Fm-QP-LAB-24-02'],
]

test('responsible sheet maps all seven department labels, including the source typo', () => {
  const parsed = parseLegacyResponsibleRows(responsibleRows)

  assert.deepEqual(parsed.responsibles.map((item) => item.departmentCode), ['CHE', 'IMM', 'HEM', 'MIS', 'MIC', 'MOL', 'BLB'])
  assert.equal(parsed.responsibles.find((item) => item.departmentCode === 'MIC')?.displayName, 'นาคพรรดิ')
  assert.deepEqual(parsed.issues, [])
})

test('responsible matching uses the sheet department and short name, even when profile dept differs', () => {
  const parsed = parseLegacyResponsibleRows(responsibleRows)
  const result = resolveLegacyAssignees(parsed.responsibles.filter((item) => item.departmentCode === 'CHE' || item.departmentCode === 'MIS'), [
    { id: 'che-id', name: 'สุธีมนต์ รัตนปรีดากุล', dept: 'งานเคมีคลินิก', role: 'Medical Technologist' },
    { id: 'mis-id', name: 'วรวุฒิ วงษ์เจริญผล', dept: 'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ', role: 'Admin' },
  ])

  assert.equal(result.issues.length, 0)
  assert.deepEqual(result.matches.map((item) => [item.departmentCode, item.profileId]), [
    ['CHE', 'che-id'],
    ['MIS', 'mis-id'],
  ])
})

test('responsible matching fails closed when a short name is missing or ambiguous', () => {
  const parsed = parseLegacyResponsibleRows([
    ['งาน', 'ชื่อ-นามสกุล', 'ตำแหน่ง'],
    ['เคมีคลินิก', 'ไม่มีในระบบ', 'นักเทคนิคการแพทย์'],
    ['โลหิต', 'สิริมา', 'นักเทคนิคการแพทย์'],
  ])
  const result = resolveLegacyAssignees(parsed.responsibles, [
    { id: 'one', name: 'สิริมา หนึ่ง', dept: null, role: 'Medical Technologist' },
    { id: 'two', name: 'สิริมา สอง', dept: null, role: 'Medical Technologist' },
  ])

  assert.equal(result.matches.length, 0)
  assert.equal(result.issues.length, 2)
  assert.match(result.issues.join(' '), /ไม่พบ profile|มากกว่า 1 profile/)
})
