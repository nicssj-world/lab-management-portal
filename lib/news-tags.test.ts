import assert from 'node:assert/strict'
import { extractNewsTags } from './news-tags'

assert.deepEqual(
  extractNewsTags(
    '<p>ข่าวอบรม #ตรวจสอบ</p><span style="color:#dc2626;background:#e1e0ee">ข้อความ</span><p>#ห้องแล็บ</p>',
    'training',
  ),
  ['กิจกรรมอบรม', 'ตรวจสอบ', 'ห้องแล็บ'],
)

assert.deepEqual(extractNewsTags('<p>ไม่มีแท็ก</p>', 'announce'), ['ข่าวประชาสัมพันธ์'])

console.log('lib/news-tags.test.ts: all assertions passed')
