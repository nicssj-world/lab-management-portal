import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const categories = readFileSync('app/(protected)/staff/documents/categories/CategoriesClient.tsx', 'utf8')
const documents = readFileSync('app/(protected)/staff/documents/DocumentsClient.tsx', 'utf8')

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

assert.match(categories, /const \[readingDocIds, setReadingDocIds\] = useState<Set<string>>\(new Set\(\)\)/, 'categories page should track documents currently opening')
assert.match(quickRead, /if \(readingDocIds\.has\(doc\.id\)\) return/, 'quick read should ignore duplicate clicks while the same document is opening')
assert.match(quickRead, /setReadingDocIds\(\(prev\) => new Set\(prev\)\.add\(doc\.id\)\)/, 'quick read should lock the document before requesting it')
assert.match(quickRead, /finally/, 'quick read should always release its loading lock')
assert.match(quickRead, /next\.delete\(doc\.id\)/, 'quick read should allow retry after the request completes')
assert.match(categories, /disabled=\{readingDocIds\.has\(d\.id\)\}/, 'category eye should be disabled while its document is opening')

console.log('document read status UI tests passed')
