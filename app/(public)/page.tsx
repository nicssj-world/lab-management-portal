import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategories } from '@/lib/queries/categories'
import { getNews } from '@/lib/queries/news'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'

export default async function PublicHome() {
  const supabase = await createClient()
  const [categories, featuredNews] = await Promise.all([
    getCategories(supabase),
    getNews(supabase, { publishedOnly: true, limit: 3 }),
  ])

  return (
    <main style={{ background: 'var(--bg)' }}>
      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)',
          color: '#fff', padding: '64px 28px 80px', position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -80, top: -40, width: 460, height: 460, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -100, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          <Badge color="blue" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', marginBottom: 16, display: 'inline-flex' }}>
            ISO 15189:2022 · ISO 15190:2020 Accredited
          </Badge>
          <h1 style={{ fontSize: 44, fontWeight: 700, margin: '0 0 16px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>
            คู่มือการส่งตรวจทางห้องปฏิบัติการ<br />Laboratory Services
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, marginTop: 0, lineHeight: 1.6, maxWidth: 520 }}>
            ค้นหารายการตรวจวิเคราะห์ คู่มือการเก็บตัวอย่าง และเอกสารแนบต่างๆ<br />ของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรีได้ที่นี่
          </p>
          <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
            <Link href="/catalog">
              <button
                style={{
                  background: '#fff', color: 'var(--primary)', border: 'none',
                  padding: '12px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <Icon name="search" size={16} />
                ค้นหารายการตรวจ
              </button>
            </Link>
            <Link href="/manual">
              <button
                style={{
                  background: 'transparent', color: '#fff',
                  border: '1px solid rgba(255,255,255,.3)',
                  padding: '12px 22px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                คู่มือห้องปฏิบัติการ
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Service scope */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 0' }}>
        <PageHeader eyebrow="Service scope" title="ขอบเขตการให้บริการ" />
        <Card padding={28}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: 12, background: 'var(--primary-soft)',
                color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Icon name="microscope" size={22} />
            </div>
            <div>
              <div style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)' }}>กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี</div>
              <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>Department : Medical Technology</div>
            </div>
          </div>
          <p style={{ fontSize: 14, color: 'var(--ink)', lineHeight: 1.85, margin: 0 }}>
            มีบทบาทหน้าที่ในการให้บริการตรวจวิเคราะห์ทางห้องปฏิบัติการสำหรับ{' '}
            ผู้ป่วยใน ผู้ป่วยนอก และผู้ป่วยฉุกเฉิน <strong>ตลอด 24 ชั่วโมง</strong> รวมถึง
            คลินิกนอกเวลาราชการ ในวันทำการ (วันจันทร์–ศุกร์) เวลา 16.00–24.00 น. และวันหยุดราชการ เวลา 08.00–24.00 น.
            การตรวจสุขภาพประจำปีแบบหมู่คณะ และผู้มารับบริการทั้งหน่วยงานภายในและภายนอก
            (เฉพาะในเวลาราชการ 08.00-15.30 น.) 
            <br /><br />ส่วนรายการตรวจตรวจวิเคราะห์บางรายการที่ยังไม่เปิดให้บริการ จะดำเนินการส่งต่อยังห้องปฏิบัติการภายนอกที่มีคุณภาพมาตรฐานทั้งภาครัฐและภาคเอกชน
            <br />ผู้รับบริการสามารถดูรายละเอียดตามรายการทดสอบที่หมวดหมู่ <strong>ตรวจพิเศษและปฏิบัติการตรวจต่อ (OUT LAB)</strong>
          </p>
        </Card>
      </section>

      {/* News */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <PageHeader eyebrow="News" title="แจ้งข่าวสารห้องปฏิบัติการ" />
          <Link href="/news" style={{ fontSize: 13, color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
            ดูทั้งหมด →
          </Link>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {featuredNews.map((n) => (
            <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none' }}>
              <Card hoverable padding={20}>
                {n.is_new && (
                  <Badge color="red" style={{ marginBottom: 10, display: 'inline-flex' }}>NEW</Badge>
                )}
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.4 }}>
                  {n.title}
                </div>
                {n.excerpt && (
                  <div style={{ fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.6 }}>{n.excerpt}</div>
                )}
                <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--muted)' }}>
                  {n.created_at ? new Date(n.created_at).toLocaleDateString('th-TH') : ''}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 60px' }}>
        <PageHeader
          eyebrow="Categories"
          title="ค้นหารายการตรวจวิเคราะห์ตามหมวดหมู่"
          subtitle={`รวม ${categories.length} หมวดหมู่ทางห้องปฏิบัติการ`}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {categories.map((c) => (
            <Link key={c.id} href={`/catalog?cat=${c.id}`} style={{ textDecoration: 'none' }}>
              <Card hoverable padding={20}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: `${c.color}18`, color: c.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12,
                  }}
                >
                  <Icon name={c.icon} size={20} />
                </div>
                <div style={{ fontWeight: 600, fontSize: 14.5, color: 'var(--ink)' }}>{c.th}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{c.en}</div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
