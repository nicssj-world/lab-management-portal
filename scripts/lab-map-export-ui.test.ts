import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { isProtectedPath } from '../lib/auth/session-guard'
const read = (path: string) => existsSync(path) ? readFileSync(path, 'utf8') : ''
const page = read('app/(protected)/staff/lab-map/print/page.tsx')
const client = read('components/lab-map/LabMapExportClient.tsx')
const sheet = read('components/lab-map/LabMapPrintSheet.tsx')
const printStyles = read('components/lab-map/LabMapPrintStyles.tsx')
const helper = read('lib/lab-map/export-client.ts')
const staffPage = read('app/(protected)/staff/lab-map/page.tsx')
const publicPage = read('app/(public)/lab-map/[stationCode]/page.tsx')

assert.equal(isProtectedPath('/staff/lab-map/print'), true)
assert.ok(page.includes('getActor'))
assert.ok(page.includes("redirect('/login')"))
assert.ok(page.includes('buildMapPrintDTO'))
assert.ok(client.includes('ฉบับใช้งานจริง'))
assert.ok(client.includes('disabled={!dto.official') || client.includes('!dto.official'))
assert.ok(client.includes('ร่าง — ห้ามใช้ติดตั้ง') || page.includes('ร่าง — ห้ามใช้ติดตั้ง'))
assert.ok(helper.includes('document.fonts.ready'))
assert.ok(helper.includes("import('html2canvas')"))
assert.ok(helper.includes("import('jspdf')"))
assert.ok(helper.includes('A3.pdf') || helper.includes('paperSize'))
assert.ok(staffPage.includes('/staff/lab-map/print'))
assert.match(helper, /data-qr-state/, 'export waits until the QR has finished rendering before capture')
assert.match(helper, /pdf\.addImage\(canvas\.toDataURL\('image\/png'\)/, 'PDF export preserves QR modules without JPEG artifacts')
assert.match(sheet, /data-qr-state=\{qrState\}/, 'the print sheet exposes its QR render state to the exporter')
assert.match(sheet, /errorCorrectionLevel:\s*'H'/, 'QR exports use high error correction for physical signs')

// ── กันบั๊กแผ่นพิมพ์ดำสนิท: LabMapPrintSheet ต้องประกาศตัวแปรสี (LabMapStyles) ก่อนใช้ ──
// ที่มา: fill: var(--map-floor) ฯลฯ ประกาศอยู่ใต้ .lab-map-shell เท่านั้น — ไม่มี wrapper นี้
// ตัวแปรว่างเปล่า SVG fill จึงตกกลับไปเป็นสีดำของเบราว์เซอร์ทั้งพื้น ห้อง และเส้น
assert.match(sheet, /import { LabMapStyles }/, 'the print sheet imports the shared style/token component')
assert.match(sheet, /<LabMapStyles \/>/, 'the print sheet renders LabMapStyles so --map-* tokens resolve')
assert.match(sheet, /className="lab-map-shell lab-map-print-sheet"/, 'the print sheet wraps its canvas in .lab-map-shell so tokens cascade to it')
assert.match(printStyles, /\.lab-map-shell\.lab-map-print-sheet\s*\{[^}]*--map-floor/, 'print output pins light-mode token values regardless of the viewer\'s dark-mode setting')

// ข้อความ "ท่านอยู่ที่นี่" ต้องมีแถวของตัวเองเสมอ มิฉะนั้นแผนที่จะชิดทับข้อความ
// ระหว่างการ capture เป็น PDF/PNG (พบจริงกับแผ่น A3 เส้นทางหนีไฟ)
assert.match(printStyles, /\.lab-map-print-sheet\s*\{[^}]*grid-template-rows:\s*auto auto minmax\(0,1fr\) auto/, 'the print sheet reserves a dedicated row for the station banner')
assert.match(printStyles, /\.lab-map-print-you-are-here\s*\{[^}]*margin-bottom:/, 'the station banner has a visible separation from the map viewport')

// จุดติดตั้ง/ปลายทางในหน้าส่งออกต้องแสดงชื่อไทย ไม่ใช่รหัสดิบ
assert.match(client, /stationOptions/)
assert.match(client, /installationPoint/)
assert.match(client, /accessPointNameByCode/, 'destination options are labelled from access point Thai names, not raw codes')
assert.doesNotMatch(client, /<option key=\{code\} value=\{code\}>\{code\}<\/option>/, 'no dropdown falls back to printing the raw station code')

// สถานีชนิด checkpoint ต้องไม่เข้าแคตตาล็อกงานพิมพ์ — ไม่ใช่จุดติดตั้งป้ายจริง
assert.match(page, /installationStations/)
assert.match(page, /kind === 'installation'/)

// QR ของป้ายต้องเปิดได้โดยไม่ต้องมี session และต้องผูกกับจุดติดตั้งของป้ายนั้น
assert.ok(publicPage.includes('buildPublicSafetyMap'), 'the QR destination renders a constrained public safety map')
assert.ok(publicPage.includes('getPublishedLabMapSnapshot'), 'the QR destination resolves the currently published release')
assert.ok(publicPage.includes("allowedModes={['safety']}"), 'the public QR destination exposes only evacuation information')
assert.match(publicPage, /ขณะนี้ยังไม่มีแผนที่ออนไลน์ฉบับใช้งาน/, 'QR scans show the approved public message while no online map exists')
assert.doesNotMatch(publicPage, /if \(!published\) notFound\(\)/, 'a QR scan never fails as an unexplained 404 solely because publication is pending')
assert.match(page, /publicSafetyMapPath/, 'export QR URLs are unique to each sign installation point')
assert.doesNotMatch(page, /webUrl: `\$\{siteUrl\}\/staff\/lab-map`/, 'exported QR codes never point at the protected staff page')
assert.match(page, /https:\/\/lab-management-cbh\.vercel\.app/, 'QR exports default to the live application origin')
assert.doesNotMatch(page, /https:\/\/lab\.chonburihospital\.go\.th/, 'QR exports no longer default to the retired origin')

console.log('lab map export UI contract passed')
