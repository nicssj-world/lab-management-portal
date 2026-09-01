import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const categories = readFileSync('app/(protected)/staff/documents/categories/CategoriesClient.tsx', 'utf8')
const documents = readFileSync('app/(protected)/staff/documents/DocumentsClient.tsx', 'utf8')
const detail = readFileSync('components/documents/DocumentDetailModal.tsx', 'utf8')
const readRoute = readFileSync('app/api/admin/documents/[id]/read/route.ts', 'utf8')
const actionPanel = readFileSync('components/documents/DocumentActionPanel.tsx', 'utf8')

const quickReadStart = categories.indexOf('async function quickRead')
const quickReadEnd = categories.indexOf('\n  async function handleDownload', quickReadStart)
const quickRead = quickReadStart >= 0 && quickReadEnd >= 0 ? categories.slice(quickReadStart, quickReadEnd) : ''

const readStatusEndpoint = "fetch('/api/admin/documents/my-reads')"
assert.match(categories, new RegExp(readStatusEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'categories page should hydrate read status from the shared endpoint')
assert.match(categories, /setReadDocIds\(new Set\(ids\)\)/, 'categories page should store the shared read IDs')
assert.match(categories, /const hasRead = readDocIds\.has\(d\.id\)/, 'categories eye should derive its state from read IDs')
assert.match(categories, /border: `1px solid \$\{hasRead \? 'var\(--success\)' : 'var\(--border\)'\}`/, 'categories eye should use the same read border state')
assert.match(categories, /color: hasRead \? 'var\(--success\)' : 'var\(--muted\)'/, 'categories eye should use the same read color state')

assert.match(documents, new RegExp(readStatusEndpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'documents page should keep using the shared read-status endpoint')
assert.match(documents, /border: `1px solid \$\{hasRead \? 'var\(--success\)' : 'var\(--border\)'\}`/, 'documents eye should keep the shared read border state')
assert.match(documents, /color: hasRead \? 'var\(--success\)' : 'var\(--muted\)'/, 'documents eye should keep the shared read color state')
assert.match(documents, /canRead && isReadableDocument\(doc\)/, 'documents page should show Read only for Published documents with an official file')
assert.match(categories, /isReadableDocument\(d\) \?/, 'categories page should show Read only for Published documents with an official file')
assert.match(detail, /isReadableDocument\(doc\) &&/, 'document detail should show Read only for Published documents with an official file')
assert.match(readRoute, /if \(doc\.status !== 'Published'\)/, 'read API should reject non-Published documents')
assert.match(readRoute, /status: 403/, 'read API should return Forbidden for non-Published documents')
assert.match(actionPanel, /documents\/download\?path=\$\{encodeURIComponent\(path\)\}&variant=preview/, 'workflow preview should use the non-compliance preview route')
assert.doesNotMatch(actionPanel, /documents\/\$\{doc\.id\}\/read/, 'workflow preview should not create a read-compliance log')

assert.match(categories, /const \[readingDocIds, setReadingDocIds\] = useState<Set<string>>\(new Set\(\)\)/, 'categories page should track documents currently opening')
assert.match(quickRead, /if \(readingDocIds\.has\(doc\.id\)\) return/, 'quick read should ignore duplicate clicks while the same document is opening')
assert.match(quickRead, /setReadingDocIds\(\(prev\) => new Set\(prev\)\.add\(doc\.id\)\)/, 'quick read should lock the document before requesting it')
assert.match(quickRead, /finally/, 'quick read should always release its loading lock')
assert.match(quickRead, /next\.delete\(doc\.id\)/, 'quick read should allow retry after the request completes')
assert.match(categories, /disabled=\{readingDocIds\.has\(d\.id\)\}/, 'category eye should be disabled while its document is opening')

console.log('document read status UI tests passed')
