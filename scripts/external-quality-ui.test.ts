import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const required = [
  'app/(protected)/staff/outlab/page.tsx',
  'app/(protected)/staff/eqa/page.tsx',
  'components/outlab/OutlabDashboard.tsx',
  'components/eqa/EqaDashboard.tsx',
  'components/dashboard/ExternalQualityAlerts.tsx',
  'lib/external-quality/dashboard.ts',
]
for (const file of required) assert.equal(existsSync(file), true, `exists: ${file}`)

const sidebar = readFileSync('components/layout/StaffSidebar.tsx', 'utf8')
const topbar = readFileSync('components/layout/StaffTopbar.tsx', 'utf8')
assert.ok(sidebar.includes("'/staff/outlab'"))
assert.ok(sidebar.includes("'/staff/eqa'"))
assert.ok(topbar.includes("'/staff/outlab'"))
assert.ok(topbar.includes("'/staff/eqa'"))

const manual = readFileSync('app/(public)/manual/page.tsx', 'utf8')
assert.ok(manual.includes('getPublicOutlabPartners'))
const dashboard = readFileSync('app/(protected)/staff/dashboard/page.tsx', 'utf8')
assert.ok(dashboard.includes('ExternalQualityAlerts'))
const outlabDashboard = readFileSync('components/outlab/OutlabDashboard.tsx', 'utf8')
const eqaDashboard = readFileSync('components/eqa/EqaDashboard.tsx', 'utf8')
const navigation = readFileSync('lib/navigation.ts', 'utf8')
assert.ok(outlabDashboard.includes('รหัส E-Phis'))
assert.equal(outlabDashboard.includes('>หรือชื่ออิสระ<'), false)
assert.ok(outlabDashboard.includes('findOutlabCatalogTestByEphisCode'))
assert.ok(outlabDashboard.includes('outlab-services-table'), 'บริการส่งต่อต้องมี layout ตารางเฉพาะ')
assert.ok(outlabDashboard.includes('data-service-action'), 'ปุ่มจัดการบริการต้องอยู่ในคอลัมน์ที่มีพื้นที่คงที่')
assert.ok(outlabDashboard.includes('<th>รหัส E-Phis</th>'), 'ตารางบริการส่งต่อต้องแสดงรหัส E-Phis แยกคอลัมน์')
assert.ok(outlabDashboard.includes('availableOutlabCatalogTests'), 'ฟอร์มบริการส่งต่อต้องกรอง Catalog ที่มีบริการแล้ว')
assert.ok(outlabDashboard.includes('laboratoriesWithoutCurrentCertificate'), 'แจ้งเตือนใบรับรองต้องคำนวณรายการเพียงครั้งเดียว')
assert.ok(outlabDashboard.includes('outlab-missing-certificate-list'), 'แจ้งเตือนใบรับรองต้องแสดงเป็นรายการที่สแกนง่าย')
assert.ok(eqaDashboard.includes('กรองตามหมวด'), 'EQA ต้องใช้หมวดแทนสาขาในการกรอง')
assert.ok(eqaDashboard.includes('label: \'หมวด\''), 'EQA ต้องใช้หมวดในฟอร์มแก้ไขโครงการ')
assert.ok(outlabDashboard.includes('quality-module'), 'OUTLAB ต้องใช้ style ร่วมของโมดูลคุณภาพ')
assert.ok(eqaDashboard.includes('quality-module'), 'EQA ต้องใช้ style ร่วมของโมดูลคุณภาพ')
assert.ok(outlabDashboard.includes('<PageHeader'), 'OUTLAB ต้องใช้โครงหัวเดียวกับโมดูลแบบสำรวจ')
assert.ok(eqaDashboard.includes('<PageHeader'), 'EQA ต้องใช้โครงหัวเดียวกับโมดูลแบบสำรวจ')
assert.ok(outlabDashboard.includes('<ModuleSubnav') && navigation.includes('OUTLAB_NAVIGATION'), 'OUTLAB ต้องมี route navigation พร้อมไอคอน')
assert.ok(eqaDashboard.includes('<ModuleSubnav') && navigation.includes('EQA_NAVIGATION'), 'EQA ต้องมี route navigation พร้อมไอคอน')
const riskClient = readFileSync('components/risk/RiskClient.tsx', 'utf8')
assert.ok(riskClient.includes('<PageHeader') && riskClient.includes('<ModuleSubnav'), 'โมดูลความเสี่ยงต้องใช้โครงหัวและ route navigation เดียวกับแบบสำรวจ')

console.log('scripts/external-quality-ui.test.ts: all assertions passed')
