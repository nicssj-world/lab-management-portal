import assert from 'node:assert/strict'
import { extractText, getDocumentProxy } from 'unpdf'

async function main() {
  const mod = await import('./agreement-campaign-report-pdf').catch(() => null)
  assert.ok(mod, 'campaign report PDF module should exist')
  const pdf = await mod.generateAgreementCampaignReportPdf({
    title: 'ข้อตกลงประจำปีงบประมาณ พ.ศ. 2570', fiscalYear: 2570, opensOn: '2026-10-01', dueOn: '2026-11-30', status: 'approved', approvedAt: '2026-11-20T08:00:00Z',
    recipients: [
      { name: 'สมชาย ใจดี', position: 'นักเทคนิคการแพทย์', status: 'completed', disclosureName: 'บรรยายวิชาการ' },
      { name: 'สมหญิง ใจงาม', position: null, status: 'exempt', exemptReason: 'ลาศึกษาต่อ' },
    ],
  })
  const proxy = await getDocumentProxy(pdf)
  const extracted = await extractText(proxy, { mergePages: true })
  const text = String(extracted.text).replace(/\s+/g, ' ')
  assert.match(text, /ข้อตกลงประจำปีงบประมาณ/)
  assert.match(text, /สมชาย ใจดี/)
  assert.match(text, /บรรยายวิชาการ/)
  assert.match(text, /รับรองแล้ว/)
}

void main()
