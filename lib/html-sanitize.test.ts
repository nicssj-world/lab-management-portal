import assert from 'node:assert/strict'
import {
  htmlToPlainText,
  MEETING_SUMMARY_MAX_HTML_LENGTH,
  normalizeMeetingSummaryHtml,
  sanitizeMeetingSummaryHtml,
} from './html-sanitize'

assert.equal(
  sanitizeMeetingSummaryHtml(
    '<strong onclick="bad()">หนา</strong><b>หนาอีก</b><em>เอียง</em><i>เอียงอีก</i><u>ขีด</u>',
  ),
  '<strong>หนา</strong><strong>หนาอีก</strong><em>เอียง</em><em>เอียงอีก</em><u>ขีด</u>',
)

assert.equal(
  sanitizeMeetingSummaryHtml(
    '<span style="color: #1E5FAD; font-size: 72px; background: red">สีน้ำเงิน</span><font color="red" face="Arial" size="7">สีแดง</font>',
  ),
  '<span style="color: #1e5fad">สีน้ำเงิน</span><span style="color: red">สีแดง</span>',
)

assert.equal(
  sanitizeMeetingSummaryHtml('<div>ข้อ 1<br>ข้อ 2</div><p>ย่อหน้าใหม่</p>'),
  '<div>ข้อ 1<br />ข้อ 2</div><p>ย่อหน้าใหม่</p>',
)
assert.equal(htmlToPlainText('<div>ข้อ 1<br />ข้อ 2</div><p>ย่อหน้าใหม่</p>'), 'ข้อ 1\nข้อ 2\nย่อหน้าใหม่')

assert.equal(
  sanitizeMeetingSummaryHtml(
    '<script>alert(1)</script><a href="javascript:alert(1)" onclick="bad()">ข้อความลิงก์</a><img src="x" onerror="bad()">ปลอดภัย',
  ),
  'ข้อความลิงก์ปลอดภัย',
)
assert.equal(
  sanitizeMeetingSummaryHtml('<span style="color: url(javascript:bad); font-family: Arial">ข้อความ</span>'),
  '<span>ข้อความ</span>',
)

const legacy = 'มติข้อที่ 1\nมติข้อที่ 2'
assert.equal(sanitizeMeetingSummaryHtml(legacy), legacy)
assert.equal(normalizeMeetingSummaryHtml('<br><script>discard</script>'), '')
assert.equal(normalizeMeetingSummaryHtml('   '), '')

const bounded = sanitizeMeetingSummaryHtml(`<strong>${'x'.repeat(MEETING_SUMMARY_MAX_HTML_LENGTH + 500)}</strong>`)
assert.ok(bounded.length <= MEETING_SUMMARY_MAX_HTML_LENGTH, 'sanitizer bounds raw editor content')

console.log('html-sanitize tests passed')
