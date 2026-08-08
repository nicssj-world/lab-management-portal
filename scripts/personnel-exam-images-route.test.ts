import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
const presign = read('app/api/admin/personnel/exams/images/presign/route.ts')
const cleanup = read('app/api/admin/personnel/exams/images/route.ts')
const server = read('lib/personnel/exam-image-server.ts')

assert.ok(presign.includes('requirePersonnelManage'), 'presign must require personnel manager access')
assert.ok(server.includes('getSignedUrl') && server.includes('PutObjectCommand'), 'presign must create a direct R2 PUT URL')
assert.ok(presign.includes("const contentType = 'image/webp'"), 'presign must pin the stored content type')
assert.ok(cleanup.includes('DeleteObjectCommand'), 'cleanup must delete through R2')
assert.ok(cleanup.includes('requirePersonnelManage'), 'cleanup must require personnel manager access')
assert.ok(server.includes('HeadObjectCommand'), 'server must verify uploaded objects before persistence')
assert.ok(server.includes('GetObjectCommand'), 'server must create signed read URLs')

console.log('personnel exam image routes: contract ok')
