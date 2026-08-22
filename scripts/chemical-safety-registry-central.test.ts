import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (relativePath: string) => readFileSync(join(root, relativePath), 'utf8')

const sdsClient = read('components/chemical-safety/SdsManagementClient.tsx')
const hub = read('components/chemical-safety/ChemicalSafetyHubClient.tsx')
const publishRoute = read('app/api/admin/chemical-safety/department-sds/[code]/publish/route.ts')
const mutationRoute = read('app/api/admin/chemical-safety/department-sds/[code]/route.ts')
const replaceRoute = read('app/api/admin/chemical-safety/department-sds/[code]/replace/route.ts')
const registerSdsOnlyRoute = read('app/api/admin/chemical-safety/department-sds/[code]/register-sds-only/route.ts')
const legacyUploadRoute = read('app/api/admin/chemical-safety/department-sds/[code]/upload/route.ts')
const registryDepartmentPublicationRoute = read('app/api/admin/chemical-safety/registry/department-publication/route.ts')
const registrySdsRoute = read('app/api/admin/chemical-safety/sds/[id]/route.ts')
const registryUploadRoute = read('app/api/admin/chemical-safety/sds/[id]/upload/route.ts')

assert.doesNotMatch(sdsClient, /fetch\(/, 'staff SDS views must be read-only and must not perform mutations')
assert.doesNotMatch(sdsClient, /register-sds-only|department-sds\/.*\/publish|department-sds\/.*\/replace/i)
assert.doesNotMatch(sdsClient, /เพิ่มเข้าทะเบียนสารเคมี|แทนที่ไฟล์|ลบเอกสาร|แก้ไขชื่อ/)
assert.match(hub, /เผยแพร่ทั้งงาน/, 'the whole-work publication action must remain visible in the registry')
assert.match(hub, /publishableDepartmentCodes/, 'the registry must receive department publication permissions')
assert.match(hub, /registry\/department-publication/, 'the whole-work publication action must call the registry endpoint')

assert.match(registryDepartmentPublicationRoute, /set_chemical_sds_department_publication_status/)
assert.match(registryDepartmentPublicationRoute, /requireDepartmentSdsPublisher/)
assert.match(registryDepartmentPublicationRoute, /status:\s*422/)

for (const [name, source] of [
  ['department publication route', publishRoute],
  ['department SDS mutation route', mutationRoute],
  ['department SDS replace route', replaceRoute],
  ['department SDS-only route', registerSdsOnlyRoute],
  ['department SDS upload route', legacyUploadRoute],
] as const) {
  assert.match(source, /department_sds_read_only|department_sds_creation_closed|department_sds_link_existing_closed/i, `${name} must expose a read-only/closed marker`)
  assert.match(source, /status:\s*410/, `${name} must return Gone`)
}

assert.match(registrySdsRoute, /publishSdsForHolding/, 'registry SDS metadata save must auto-publish')
assert.match(registryUploadRoute, /publishSdsForHolding/, 'registry SDS file upload must auto-publish')
const workflow = read('lib/chemical-safety/sds-workflow.ts')
assert.match(workflow, /publish_chemical_sds/, 'registry auto-publish must use the database workflow')
assert.match(workflow, /link_chemical_sds_publication/, 'registry auto-publish must keep the registry publication link in sync')

console.log('chemical-safety registry central workflow contract passed')
