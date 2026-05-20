import { Icon } from '@/components/ui/Icon'

const STAFF_DIRECTORY = [
  { name: 'น.ส. ณัฏฐ์ฤทัย ไพโรจน์',       position: 'นักเทคนิคการแพทย์ชำนาญการพิเศษ', responsibility: 'หัวหน้ากลุ่มงานเทคนิคการแพทย์',                                            phones: ['1453'] },
  { name: 'นายสิทธิพงศ์ ทับทิม',            position: 'นักเทคนิคการแพทย์ชำนาญการพิเศษ', responsibility: 'รองหัวหน้ากลุ่มงานฯ\nหัวหน้างานเคมีคลินิกและงานภูมิคุ้มกันวิทยาคลินิก', phones: ['1464', '1469'] },
  { name: 'น.ส. พรหทัย สร้อยสุวรรณ',       position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานโลหิตวิทยาคลินิกและงานจุลกรรศนศาสตร์คลินิก',                phones: ['1465', '1466', '1468'] },
  { name: 'นายศิริวัฒน์ จำปีรัตน์',         position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานอณูชีววิทยาและงานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',        phones: ['1452', '1461', '1467'] },
  { name: 'น.ส. ปภัชญา สุขจำรัส',           position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานจุลชีววิทยาคลินิกและงานคลังน้ำยา',                            phones: ['1462-63'] },
  { name: 'น.ส. ภสพร อินทร์อาสา',           position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานคลังเลือด',                                                    phones: ['1458'] },
  { name: 'น.ส. ลลิตา เหลืองพิพัฒน์สร',   position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานบริการผู้ป่วยนอก',                                             phones: ['1606-07'] },
  { name: 'นางณฑมล งามวชิราพร',             position: 'นักเทคนิคการแพทย์ชำนาญการ',       responsibility: 'หัวหน้างานห้องปฏิบัติการ ศสม. เมืองชลบุรี',                             phones: ['1633-4'] },
  { name: '-',                               position: 'เจ้าหน้าที่ธุรการ',               responsibility: 'งานธุรการ กลุ่มงานเทคนิคการแพทย์',                                       phones: ['1455'] },
]

const SECTION_HEADER: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: '#EFF6FF', borderRadius: '12px 12px 0 0',
  padding: '14px 20px', borderBottom: '1px solid #BFDBFE',
}

export default function ContactPage() {
  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '36px 28px 64px' }}>

        {/* Page title */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
            ติดต่อ กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', margin: 0 }}>
            สถานที่ติดต่อราชการ และข้อมูลการประสานงาน
          </p>
        </div>

        {/* Section 1: Address */}
        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 24, overflow: 'hidden' }}>
          <div style={SECTION_HEADER}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon name="building" size={17} style={{ color: '#fff' }} />
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A8A' }}>สถานที่ติดต่อราชการ</span>
          </div>

          <div style={{ padding: '24px 20px', display: 'grid', gridTemplateColumns: '1fr auto', gap: 32, alignItems: 'start' }}>
            {/* Address text */}
            <p style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.85, margin: 0 }}>
              กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ตั้งอยู่ที่{' '}
              <strong>ชั้น 3 อาคารเฉลิมราชสมบัติ</strong> เลขที่{' '}
              69 หมู่ 2 ถนนสุขุมวิท <br />ตำบลบ้านสวน อำเภอเมือง จังหวัดชลบุรี รหัสไปรษณีย์{' '}20000
            </p>

            {/* Contact cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 240 }}>
              {[
                { icon: 'bell',   label: 'โทรศัพท์', value: '(038) 931-455' },
                { icon: 'doc',    label: 'โทรสาร',   value: '(038) 931-455' },
              ].map((c) => (
                <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#1E3A8A', borderRadius: 10, padding: '12px 16px' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon name={c.icon} size={15} style={{ color: '#fff' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,.65)', marginBottom: 1 }}>{c.label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>{c.value}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Staff directory */}
        <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ ...SECTION_HEADER, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: '#1D4ED8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon name="users" size={17} style={{ color: '#fff' }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#1E3A8A' }}>การติดต่อประสานงาน</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8', background: '#DBEAFE', padding: '3px 12px', borderRadius: 20 }}>
              {STAFF_DIRECTORY.length} รายชื่อ
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  {['#', 'ชื่อ – สกุล', 'ตำแหน่ง', 'หน้าที่รับผิดชอบ', 'โทรศัพท์ภายใน'].map((h, i) => (
                    <th key={h} style={{
                      padding: '11px 16px', textAlign: i === 0 ? 'center' : 'left',
                      fontSize: 12.5, fontWeight: 700, color: 'var(--muted)',
                      borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAFF_DIRECTORY.map((s, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {/* # */}
                    <td style={{ padding: '14px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13, width: 40 }}>{i + 1}</td>
                    {/* Name */}
                    <td style={{ padding: '14px 16px', fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap' }}>{s.name}</td>
                    {/* Position */}
                    <td style={{ padding: '14px 16px', color: '#2563EB', fontSize: 13, whiteSpace: 'nowrap' }}>{s.position}</td>
                    {/* Responsibility */}
                    <td style={{ padding: '14px 16px', color: 'var(--ink)', lineHeight: 1.7 }}>
                      {s.responsibility.split('\n').map((line, j, arr) => (
                        <span key={j}>{line}{j < arr.length - 1 && <br />}</span>
                      ))}
                    </td>
                    {/* Phones */}
                    <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                        {s.phones.map((p) => (
                          <span key={p} style={{ display: 'inline-block', background: '#DBEAFE', color: '#1D4ED8', fontWeight: 700, fontSize: 13, padding: '3px 14px', borderRadius: 20, whiteSpace: 'nowrap' }}>
                            {p}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '12px 18px', background: '#FFFBEB', borderTop: '1px solid #FDE68A', fontSize: 12.5, color: '#92400E' }}>
            <Icon name="alert" size={14} style={{ flexShrink: 0, marginTop: 1, color: '#D97706' }} />
            <span>โทรศัพท์ภายในใช้สำหรับการประสานงานในโรงพยาบาล กรณีติดต่อจากภายนอกกรุณาใช้หมายเลข <strong>(038) 931-455</strong> แล้วต่อเบอร์ภายใน</span>
          </div>
        </div>

      </div>
    </main>
  )
}
