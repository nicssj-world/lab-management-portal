import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

assert.ok(
  existsSync('components/tests/CatalogDetailModal.tsx'),
  'catalog list should have a focused detail modal component',
)

assert.ok(
  existsSync('app/api/tests/[id]/route.ts'),
  'catalog modal should fetch a sanitized public detail payload instead of using admin endpoints',
)

const modalSource = readFileSync('components/tests/CatalogDetailModal.tsx', 'utf8')
assert.match(modalSource, /^'use client'/, 'modal needs client-side open, close, and fetch behavior')
assert.match(modalSource, /import Link from 'next\/link'/, 'modal full-page action should use Next Link for client-side navigation')
assert.match(modalSource, /buildTestDetailHref/, 'modal should reuse the existing full detail href builder')
assert.match(modalSource, /role="dialog"/, 'detail card should be announced as a dialog')
assert.match(modalSource, /aria-modal="true"/, 'dialog should isolate screen reader context')
assert.match(modalSource, /aria-label="ปิดรายละเอียดรายการตรวจ"/, 'icon close button needs a descriptive Thai label')
assert.match(modalSource, /aria-label="เปิดรายละเอียดรายการตรวจแบบหน้าเต็ม"/, 'full-page action needs a descriptive Thai label')
assert.match(modalSource, /className="catalog-detail-modal-full-link"/, 'full-page action should be visually distinct from close')
assert.match(modalSource, /catalog-detail-modal-chip--ephis[\s\S]*?<strong>รหัส E-Phis:<\/strong><strong>\{activeTest\?\.code \?\? '-'\}<\/strong>/, 'the detail card E-Phis chip should keep its label and code as separate elements')
assert.match(modalSource, /\.catalog-detail-modal-chip--ephis\s*\{[\s\S]*?gap:\s*4px/, 'the detail card E-Phis chip should use a visible gap between its label and code')
assert.doesNotMatch(modalSource, /catalog-detail-modal-chip--updated/, 'the latest-update metadata should not take header space')
assert.match(modalSource, /DetailRow label="โทรศัพท์" value=\{activeTest\.contact_phone\}[\s\S]*?catalog-detail-modal-updated-at/, 'the latest-update metadata should sit directly under the phone row')
assert.match(modalSource, /catalog-detail-modal-updated-at[\s\S]*?gap:\s*5px/, 'the latest-update label and date should stay compact')
assert.match(modalSource, /แก้ไขล่าสุด/, 'the latest-update metadata should have a Thai label')
assert.match(modalSource, /new Intl\.DateTimeFormat\('th-TH'/, 'the latest-update metadata should use a Thai date format')
assert.match(modalSource, /<time dateTime=\{activeTest\.updated_at\}/, 'the latest-update metadata should expose a machine-readable date')
assert.match(modalSource, /href=\{buildTestDetailHref\(activeTest\)\}/, 'full-page action should link to the canonical catalog detail page')
assert.match(modalSource, />เปิดหน้าเต็ม</, 'full-page action should use a clear but secondary text label')
assert.match(modalSource, /event\.key === 'Escape'/, 'Escape should close the modal')
assert.match(modalSource, /document\.body\.style\.overflow = 'hidden'/, 'body scroll should be locked while the modal is open')
assert.match(modalSource, /\.catalog-detail-modal-backdrop/, 'modal should use a dedicated backdrop/scrim class')
assert.match(modalSource, /\.catalog-detail-modal-panel/, 'modal should use a focused panel class')
assert.match(modalSource, /\.catalog-detail-modal-header\s*\{[\s\S]*?position:\s*sticky/, 'modal header should stay visible while details scroll')
assert.match(modalSource, /\.catalog-detail-modal-sidebar\s*\{[\s\S]*?border-left:\s*1px solid/, 'desktop side information should be separated by a subtle vertical divider')
assert.match(modalSource, /\.catalog-detail-modal-sidebar\s*\{[\s\S]*?padding-left:\s*18px/, 'sidebar divider should have enough breathing room from the text')
assert.match(modalSource, /@media \(max-width:\s*767px\)[\s\S]*?\.catalog-detail-modal-sidebar\s*\{[\s\S]*?border-left:\s*0/, 'phone layout should remove the vertical divider')
assert.match(modalSource, /@media \(max-width:\s*767px\)[\s\S]*?\.catalog-detail-modal-sidebar\s*\{[\s\S]*?border-top:\s*1px solid/, 'phone layout should use a horizontal divider instead')
assert.match(modalSource, /min-height:\s*44px/, 'mobile and icon actions should keep touch targets at least 44px')
assert.match(modalSource, /@media \(max-width:\s*767px\)/, 'modal should have a phone-friendly layout')
assert.match(modalSource, /import \{ RefRangeModal \} from '@\/components\/tests\/RefRangeModal'/, 'table reference ranges in the card should reuse the full-page reveal control')
assert.match(modalSource, /<RefRangeModal ranges=\{referenceRanges\} tableJson=\{activeTest\.ref\} refNote=\{activeTest\.ref_note\} \/>/, 'table reference ranges should open through the same control as the full page')
assert.doesNotMatch(modalSource, /<ReferenceRangeTable ranges=\{referenceRanges\} \/>/, 'the card should not render a full reference table inline')

const catalogPageSource = readFileSync('app/(public)/catalog/page.tsx', 'utf8')
assert.match(catalogPageSource, /import \{ CatalogDetailModal \}/, 'catalog page should render the modal')
assert.match(catalogPageSource, /searchParams\.get\('open'\)/, 'catalog page should read the open query parameter')
assert.match(catalogPageSource, /selectedTestId/, 'catalog page should hold the selected test id state')
assert.match(catalogPageSource, /tests\.find\(\(test\) => test\.id === selectedTestId\)/, 'catalog page should use the loaded row as the modal fallback when available')
assert.match(catalogPageSource, /onOpen=\{\(test\) => setSelectedTestId\(test\.id\)\}/, 'test rows should open the modal instead of navigating away')
assert.match(catalogPageSource, /testId=\{selectedTestId\}/, 'catalog page should allow direct open links to fetch details even before the row is loaded')

const tableSource = readFileSync('components/tests/TestTable.tsx', 'utf8')
assert.match(tableSource, /onOpen\?: \(t: Test\) => void/, 'table should accept an optional open callback')
assert.match(tableSource, /onOpen \? onOpen\(t\) : router\.push/, 'desktop rows should prefer modal opening when provided')
assert.match(tableSource, /test-table-mobile-card-button/, 'mobile cards should be real buttons when opening in-page details')
assert.match(tableSource, /onOpen \? \(/, 'mobile rendering should branch away from Link navigation in modal mode')

const apiSource = readFileSync('app/api/tests/[id]/route.ts', 'utf8')
assert.match(apiSource, /getTestByCatalogParam/, 'detail API should support existing id/code catalog params')
assert.match(apiSource, /sanitizeTest/, 'detail API should sanitize the test through the public allow-list')
assert.doesNotMatch(apiSource, /storage_path/, 'detail API should not expose document storage paths')
assert.match(apiSource, /test_reference_ranges/, 'detail API should include reference ranges')
assert.match(apiSource, /test_documents/, 'detail API should include related document metadata')

console.log('catalog detail modal tests passed')
