import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { Badge } from '@/components/ui/Badge'

const STAFF_DIRECTORY = [
  { name: 'นางสาวสมใจ วงศ์เสรี', position: 'หัวหน้ากลุ่มงานเทคนิคการแพทย์', dept: 'บริหาร', phone: '038-931-000 ต่อ 1234' },
  { name: 'นายประสงค์ เดชา', position: 'นักเทคนิคการแพทย์', dept: 'เคมีคลินิก', phone: '038-931-000 ต่อ 1235' },
  { name: 'นางอรพรรณ พงษ์ชัย', position: 'นักเทคนิคการแพทย์', dept: 'โลหิตวิทยา', phone: '038-931-000 ต่อ 1236' },
  { name: 'นายสมชาย ทองดี', position: 'นักเทคนิคการแพทย์', dept: 'จุลชีววิทยา', phone: '038-931-000 ต่อ 1237' },
  { name: 'นางสาวพิมพ์ชนก ศรีวงศ์', position: 'นักเทคนิคการแพทย์', dept: 'ธนาคารเลือด', phone: '038-931-000 ต่อ 1238' },
  { name: 'นายวิชัย เพชรแก้ว', position: 'นักเทคนิคการแพทย์', dept: 'ปรสิตวิทยา', phone: '038-931-000 ต่อ 1239' },
  { name: 'นางสาวกานต์ชนก ลิมป์พิทักษ์', position: 'เจ้าพนักงานวิทยาศาสตร์การแพทย์', dept: 'ห้องปฏิบัติการ', phone: '038-931-000 ต่อ 1240' },
  { name: 'นายธนวัฒน์ ปิยะรัตน์', position: 'นักวิทยาศาสตร์การแพทย์', dept: 'ห้องปฏิบัติการ', phone: '038-931-000 ต่อ 1241' },
  { name: 'นางสาวอาภาพร มณีรัตน์', position: 'นักวิทยาศาสตร์การแพทย์', dept: 'ควบคุมคุณภาพ', phone: '038-931-000 ต่อ 1242' },
]

export default function ContactPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 28px 60px' }}>
        <PageHeader eyebrow="ติดต่อเรา" title="ข้อมูลการติดต่อ" subtitle="กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 32 }}>
          <Card padding={24}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="building" size={18} />
              ที่อยู่
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.8 }}>
              กลุ่มงานเทคนิคการแพทย์<br />
              โรงพยาบาลชลบุรี<br />
              ชั้น 3 อาคารพยาธิวิทยา<br />
              ถ.พระยาสัจจา ต.บางปลาสร้อย<br />
              อ.เมือง จ.ชลบุรี 20000
            </div>
          </Card>
          <Card padding={24}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="clock" size={18} />
              เวลาทำการ
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'ผู้ป่วยใน/ฉุกเฉิน', hours: 'ตลอด 24 ชั่วโมง', badge: 'green' },
                { label: 'ผู้ป่วยนอก', hours: 'จ–ศ 07:30–20:00', badge: 'blue' },
                { label: 'คลินิกนอกเวลา', hours: 'จ–ศ 16:00–24:00 · เสาร์–อาทิตย์ 08:00–24:00', badge: 'amber' },
                { label: 'ตรวจสุขภาพ', hours: 'จ–ศ 07:00–15:30 (เฉพาะเวลาราชการ)', badge: 'teal' },
              ].map((s) => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{s.hours}</div>
                  </div>
                  <Badge color={s.badge as any} size="sm">เปิด</Badge>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Staff directory */}
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="users" size={18} />
          ผู้ให้บริการ
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {STAFF_DIRECTORY.map((s) => (
            <Card key={s.name} padding={18}>
              <div
                style={{
                  width: 40, height: 40, borderRadius: 10, background: 'var(--primary-soft)',
                  color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, marginBottom: 12,
                }}
              >
                {s.name.split('').find((c) => /[ก-ฮ]/.test(c)) ?? 'ส'}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 4 }}>{s.position}</div>
              <Badge color="blue" size="sm">{s.dept}</Badge>
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--muted)' }}>{s.phone}</div>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
