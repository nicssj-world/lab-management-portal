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
  { name: 'สมชาย ใจดี', documentPosition: 'นักเทคนิคการแพทย์ปฏิบัติการ' },
  { name: 'สมหญิง ขยัน', documentPosition: 'นักเทคนิคการแพทย์ชำนาญการ' },
  { name: 'A', documentPosition: null },
  { name: 'B', documentPosition: null },
  { name: 'C', documentPosition: null },
])
assert.equal(countOccurrences(small, 'class="qt-sign-page"'), 1, 'small list fits on one page')
assert.equal(countBodyRows(small), 20, 'one page always has exactly 20 data rows')
assert.ok(small.includes('สมชาย ใจดี'), 'participant name is rendered')
assert.ok(small.includes('นักเทคนิคการแพทย์ปฏิบัติการ'), 'document position is rendered')
assert.ok(small.includes('Fm-QP-LAB-25/01'), 'form code footer is present')
assert.ok(small.includes('แบบบันทึกใบลงนามรับทราบการสื่อสารเพื่อการพัฒนา'), 'form title is present')

// 25 participants -> two pages; page 1 fully filled (no blank name cells), page 2 has 5 filled + 15 blank
const many = buildParticipantSignInHtml(
  Array.from({ length: 25 }, (_, i) => ({ name: `Person ${i + 1}`, documentPosition: null })),
)
assert.equal(countOccurrences(many, 'class="qt-sign-page"'), 2, 'more than 20 participants paginates to a second page')
assert.equal(countBodyRows(many), 40, 'two pages always have 40 data rows total (20 each)')
assert.ok(many.includes('Person 1') && many.includes('Person 20') && many.includes('Person 21') && many.includes('Person 25'))

// 0 participants -> still renders one usable blank page
const empty = buildParticipantSignInHtml([])
assert.equal(countOccurrences(empty, 'class="qt-sign-page"'), 1)
assert.equal(countBodyRows(empty), 20)

// Names must be HTML-escaped (defense in depth against a stray "<"/"&" in a profile name)
const escaped = buildParticipantSignInHtml([{ name: '<script>alert(1)</script>', documentPosition: null }])
assert.ok(!escaped.includes('<script>alert(1)</script>'), 'raw script tag must not appear unescaped')
assert.ok(escaped.includes('&lt;script&gt;'), 'name is HTML-escaped')

console.log('lib/quality-tasks/participant-sign-in-pdf.test.ts: all assertions passed')
