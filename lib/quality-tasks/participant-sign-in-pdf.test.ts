import assert from 'node:assert/strict'
import { buildParticipantSignInHtml } from './participant-sign-in-pdf'

function countOccurrences(haystack: string, needle: string) {
  return haystack.split(needle).length - 1
}

// Every body row's first cell is `<td class="c">` (row number) — header cells use <th>,
// so this marker counts exactly the data rows, independent of the header row's own <tr>.
function countBodyRows(html: string) {
  return countOccurrences(html, '<td class="c">')
}

// 5 participants -> one page, 20 total rows (5 filled + 15 blank)
const small = buildParticipantSignInHtml([
  { name: 'สมชาย ใจดี', positionTitle: 'นักเทคนิคการแพทย์ปฏิบัติการ' },
  { name: 'สมหญิง ขยัน', positionTitle: 'นักเทคนิคการแพทย์ชำนาญการ' },
  { name: 'A', positionTitle: null },
  { name: 'B', positionTitle: null },
  { name: 'C', positionTitle: null },
])
assert.equal(countOccurrences(small, 'class="qt-sign-page"'), 1, 'small list fits on one page')
assert.equal(countBodyRows(small), 35, 'one page extends the table to 35 data rows')
assert.ok(small.includes('<td class="c">20</td>'), 'the twentieth participant slot is numbered')
assert.equal(countOccurrences(small, '<td class="c"></td>'), 15, 'rows after slot 20 have no sequence number')
assert.ok(small.includes('สมชาย ใจดี'), 'participant name is rendered')
assert.ok(small.includes('นักเทคนิคการแพทย์ปฏิบัติการ'), 'document position is rendered')
assert.ok(small.includes('Fm-QP-LAB-25/01'), 'form code footer is present')
assert.ok(small.includes('แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา'), 'form title is present')
assert.ok(small.includes('@page { size: A4 portrait;'), 'print output uses A4 portrait like the original form')
assert.ok(small.includes('width: 182mm; height: 273mm;'), 'page content fits inside the portrait A4 printable area')
assert.ok(small.includes('color: #9DBFD5; opacity: .22;'), 'watermark uses the original light blue treatment')
assert.ok(!small.includes('rotate('), 'watermark stays horizontal like the original form')

// 25 participants -> two pages; page 1 fully filled (no blank name cells), page 2 has 5 filled + 15 blank
const many = buildParticipantSignInHtml(
  Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i + 1}`, positionTitle: null })),
)
assert.equal(countOccurrences(many, 'class="qt-sign-page"'), 2, 'more than 20 participants paginates to a second page')
assert.equal(countBodyRows(many), 70, 'two pages each extend to 35 data rows')
assert.ok(many.includes('Person 1') && many.includes('Person 20') && many.includes('Person 21') && many.includes('Person 25'))

// 0 participants -> still renders one usable blank page
const empty = buildParticipantSignInHtml([])
assert.equal(countOccurrences(empty, 'class="qt-sign-page"'), 1)
assert.equal(countBodyRows(empty), 35)

// Names must be HTML-escaped (defense in depth against a stray "<"/"&" in a profile name)
const escaped = buildParticipantSignInHtml([{ name: '<script>alert(1)</script>', positionTitle: null }])
assert.ok(!escaped.includes('<script>alert(1)</script>'), 'raw script tag must not appear unescaped')
assert.ok(escaped.includes('&lt;script&gt;'), 'name is HTML-escaped')

console.log('lib/quality-tasks/participant-sign-in-pdf.test.ts: all assertions passed')
