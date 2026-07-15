import assert from 'node:assert/strict'
import { extractText, getDocumentProxy } from 'unpdf'
import { generateRevisionHistoryPdf } from './revision-history-pdf'

async function testRevisionHistoryColumnsAndDates() {
  const bytes = await generateRevisionHistoryPdf({
    document: {
      id: 'doc-1',
      document_code: 'QP-LAB-03',
      title: 'การประเมินและการคัดเลือกห้องปฏิบัติการที่รับตรวจต่อและที่ปรึกษา',
      type: 'QP',
      revision: '17',
      description: 'ปรับปรุงเนื้อหา',
      owner_name: 'ผู้แก้ไขปัจจุบัน',
      approver_name: 'ผู้อนุมัติปัจจุบัน',
      file_url: 'documents/doc-1/current.pdf',
      file_name: 'current.pdf',
      edit_date: '2026-07-08',
      effective_date: '2026-07-15',
      published_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
      created_at: '2026-07-01T00:00:00.000Z',
    },
    revisions: [
      {
        id: 'legacy-1',
        revision_number: '10',
        revision_note: 'ปรับจำนวนหัวข้อหลัก',
        revised_by: 'ผู้แก้ไขเดิม',
        approved_by: 'ผู้อนุมัติเดิม',
        file_url: 'documents/doc-1/rev-10.pdf',
        file_name: 'rev-10.pdf',
        edit_date: null,
        effective_date: '2026-03-15',
        created_at: '2026-03-15T00:00:00.000Z',
        history_source: 'workflow',
      },
      {
        id: 'review-1',
        revision_number: '-',
        revision_note: 'ทบทวนแล้ว ไม่มีการแก้ไข',
        revised_by: 'ผู้ทบทวน',
        approved_by: 'ผู้อนุมัติ',
        file_url: null,
        file_name: null,
        edit_date: '2026-07-01',
        effective_date: null,
        created_at: '2026-07-01T00:00:00.000Z',
        history_source: 'review',
      },
    ],
  })

  const proxy = await getDocumentProxy(bytes)
  const extracted = await extractText(proxy, { mergePages: true })
  const text = String(extracted.text).replace(/\s+/g, ' ')

  assert.match(text, /แก้ไขครั้งที่/)
  assert.match(text, /วันที่แก้ไข/)
  assert.match(text, /วันที่บังคับใช้/)
  assert.match(text, /8 ก\.ค\. 2569/)
  assert.match(text, /15 ก\.ค\. 2569/)
  assert.equal((text.match(/15 มี\.ค\. 2569/g) ?? []).length, 2)
  assert.match(text, /ทบทวนแล้ว ไม่มีการแก้ไข/)
  assert.match(text, /- - ทบทวนแล้ว ไม่มีการแก้ไข/)
}

void testRevisionHistoryColumnsAndDates()
