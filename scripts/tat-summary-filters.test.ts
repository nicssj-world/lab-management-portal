// กันไม่ให้หน้า TAT กลับไปตอบตัวเลข "ทั้งเดือน" ให้กับ view ที่กรองแล้ว
//
// ประวัติ: tat:clean-raw ลบ tat_records/phlebotomy_records ทิ้งหลัง publish cache
// เสร็จ พอ raw หมด countTatRows() คืน 0 เสมอ route จึงตกเข้า buildLabRollupFromBase
// ซึ่งอ่านได้แค่ lab_section — ตัวกรองอื่น (ward/priority/test_name/labzone) เลย
// fallback ไปใช้ค่าจาก kpi ของทั้งเดือน แล้ว "เขียนกลับ" ลง analysis_summary_cache
// ด้วย ตัวเลขผิดจึงกลายเป็นข้อมูลถาวรและถูกเสิร์ฟซ้ำ
//
// สแกน source ไม่ใช่ฐานข้อมูล — เช็คว่าโครงป้องกันยังอยู่ครบทั้งสองฝั่ง

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
const pipeline = read('scripts/tat-local-analyze.mjs')
const route = read('app/api/admin/tat/summary/route.ts')

// --- ฝั่ง publish: ต้องมีข้อมูลจริงให้ทุกค่าของทุกตัวกรอง ---------------------
assert.match(
  pipeline,
  /async function publishFilteredSummaries\(/,
  'the local pipeline must publish a summary per filter value, or a filtered view has nothing to read',
)
for (const dimension of ['lab_section', 'labzone_name', 'priority', 'ward', 'test_name']) {
  assert.match(
    pipeline,
    new RegExp(`\\['${dimension}',`),
    `every filter the dashboard offers must be published — missing ${dimension}`,
  )
}
assert.match(
  pipeline,
  /await publishFilteredSummaries\(/,
  'publishFilteredSummaries must actually run in main(), not just exist',
)
assert.match(
  pipeline,
  /const \{ filter_options: _unused, \.\.\.payload \} = buildSummary\(/,
  'filter_options is the same list on every entry and three times the summary itself — it must be stripped',
)
assert.match(
  pipeline,
  /buildSummary\(records, phlebRows, year, month, filters\)/,
  'each entry must be recomputed from the records under its own filter, not derived from the unfiltered summary',
)

// --- ฝั่งอ่าน: ต้องใช้ของที่ publish ไว้ ก่อนจะไปสร้างตัวเลขเอง ----------------
assert.match(
  route,
  /if \(view !== 'phlebotomy' && hasSummaryFilter\(requestedFilters\)\) \{[\s\S]*?readAnalysisCacheIgnoringExpiry[\s\S]*?summaryKeyFromFilters\(year, month, requestedFilters\)/,
  'a filtered request must look for its published summary before anything else',
)
assert.match(
  route,
  /String\(published\.source\) === 'local-etl'/,
  'only a payload published by the pipeline counts — a rollup written under the same key must not be trusted',
)
const publishedLookupAt = route.indexOf('published-filter')
const persistentReadAt = route.indexOf('const persistent = await readAnalysisCache')
assert.ok(publishedLookupAt > 0 && persistentReadAt > 0)
assert.ok(
  publishedLookupAt < persistentReadAt,
  'the published lookup must come first, or a rollup cached under the view-suffixed key keeps shadowing it',
)

// --- ฝั่ง fallback: ห้ามแต่งตัวเลขให้ตัวกรองที่มันตอบไม่ได้ --------------------
assert.match(
  route,
  /function canRollupHonourFilters\(/,
  'the rollup must be able to say when it cannot answer the filter it was given',
)
assert.match(
  route,
  /const others = \[filters\.ward, filters\.priority, filters\.test_name, filters\.labzone_name\]\s*\n\s*if \(others\.some\(Boolean\)\) return false/,
  'lab_section is the only filter the base payload breaks down; every other one must refuse the rollup',
)
const rollupCalls = route.match(/buildLabRollupFromBase\(basePayloadForLab/g) ?? []
assert.equal(rollupCalls.length, 2, 'expected exactly the two known rollup call sites')
assert.equal(
  (route.match(/canRollupHonourFilters\(basePayloadForLab, requestedFilters\)/g) ?? []).length,
  2,
  'every rollup call site must be guarded, or the unfiltered month leaks back into a filtered answer',
)

// --- คีย์ทั้งสองฝั่งต้องประกอบเหมือนกัน ไม่งั้นหาไม่เจอแล้วตกไป fallback -------
const routeKey = /function summaryKeyFromFilters\([\s\S]*?const parts = \[([\s\S]*?)\]/.exec(route)
const pipelineKey = /function cacheKey\(year, month, filters = \{\}\) \{\s*return \[([\s\S]*?)\]/.exec(pipeline)
assert.ok(routeKey && pipelineKey, 'both cache-key builders must be found')
const fields = (source: string) =>
  [...source.matchAll(/filters\.(\w+)/g)].map(match => match[1])
assert.deepEqual(
  fields(routeKey[1]),
  fields(pipelineKey[1]),
  'the reader and the publisher must order the key fields identically, or every lookup misses',
)

// --- แผนก Lab ที่แสดงบน TAT dashboard: ควรรวมป้ายซ้ำ ไม่ใช่ตัด HN ทิ้ง --------
// เดิมมี "ธนาคารเลือด" กับ "ธนาคารเลือดหมวด 6" แยกกัน และ "อาชีวอนามัย" ที่เลิกใช้
// เป็นหน่วยงานแล้ว. POCT2 -> POCT ถูกพิจารณาแล้วแต่ตั้งใจไม่แตะ (ดู comment ในไฟล์
// pipeline) เพราะ Workload ยังอ้างชื่อ 'POCT2' อยู่ — เทสต์นี้ต้องไม่กลับไปคาดหวังมัน
assert.match(
  pipeline,
  /function normalizeTatLabSection\(name\) \{[\s\S]*?if \(section === 'ธนาคารเลือดหมวด 6'\) return 'ธนาคารเลือด'[\s\S]*?if \(section === 'อาชีวอนามัย'\) return 'เคมีคลินิก'/,
  'the TAT dashboard department filter must merge these two known duplicate/retired labels',
)
const tatNormalizerBody = /function normalizeTatLabSection\(name\) \{([\s\S]*?)\n\}/.exec(pipeline)?.[1] ?? ''
assert.doesNotMatch(
  tatNormalizerBody,
  /POCT/,
  'POCT2 must stay out of the TAT-only normalizer — it was deliberately left unrenamed',
)
assert.match(
  pipeline,
  /function buildSummary\(rawTatRecords, phlebRows, year, month, filters = \{\}\) \{\s*\n[\s\S]*?const allTatRecords = rawTatRecords\.map\(r => \(\{ \.\.\.r, lab_section: normalizeTatLabSection\(r\.lab_section\) \}\)\)/,
  'buildSummary must normalize its own copy of the records — mutating rawTatRecords in place would leak into buildWorkloadSummary, which is called with the same records array in main()',
)

// normalizeTatLabSection must stay a function separate from normalizeLabSection.
// The latter feeds Workload's test-to-department matching as a disambiguation
// hint (toMatchedTatRows -> preferredSection), matched against readWorkloadTestMap().
// A rule added to one for its own display reasons must never reach the other.
assert.match(
  pipeline,
  /function normalizeLabSection\(name\) \{\s*\n\s*const section = csvSafeKey\(name\)\s*\n\s*if \(section === 'ธนาคารเลือดหมวด 6'\) return 'ธนาคารเลือด'\s*\n\s*if \(section === 'อาชีวอนามัย'\) return 'เคมีคลินิก'\s*\n\s*return section\s*\n\}/,
  'normalizeLabSection (the Workload-facing function) must stay byte-for-byte as it was — no POCT2 rule added there',
)

console.log('tat summary filters: ok')
