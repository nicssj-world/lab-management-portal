import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { generateAgreementEvidencePdf } from './agreement-evidence-pdf'

const base = {
  fiscalYear: 2570,
  employeeName: 'ผู้ทดสอบ ระบบ',
  employeePosition: 'นักเทคนิคการแพทย์',
  acceptedAt: '2026-07-25T12:34:56.000Z',
  agreementDocument: { code: 'Fm-QP-LAB-27/01', title: 'หนังสือลงนามการไม่เกี่ยวข้อง', revision: '1', sha256: 'test' },
  disclosureDocument: { code: 'Fm-QP-LAB-27/02', title: 'แบบบันทึกการยินยอมเปิดเผยกิจกรรม', revision: '1', sha256: 'test' },
  signingMethod: 'drawn' as const,
}

test('uses the two-page Fm-QP-LAB-27/01 template when there is no activity', async () => {
  const bytes = await generateAgreementEvidencePdf({ ...base, disclosure: { hasActivity: false, impacts: [] } })
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 2)
  assert.deepEqual(pdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [[595.32, 841.92], [595.32, 841.92]])
})

test('appends the original Fm-QP-LAB-27/02 template when activity is disclosed', async () => {
  const bytes = await generateAgreementEvidencePdf({
    ...base,
    disclosure: { hasActivity: true, activityName: 'กิจกรรมทดสอบ', activityDate: '25 กรกฎาคม 2569', place: 'โรงพยาบาลชลบุรี', impacts: ['ability'] },
  })
  const pdf = await PDFDocument.load(bytes)
  assert.equal(pdf.getPageCount(), 3)
  assert.deepEqual(pdf.getPages().map((page) => [page.getWidth(), page.getHeight()]), [[595.32, 841.92], [595.32, 841.92], [595.32, 841.92]])
})
