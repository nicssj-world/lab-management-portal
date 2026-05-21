import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategories } from '@/lib/queries/categories'
import { getNews } from '@/lib/queries/news'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Icon } from '@/components/ui/Icon'
import { CAT_MAP } from '@/lib/validations/news'

export default async function PublicHome() {
  const supabase = await createClient()
  const [categories, featuredNews] = await Promise.all([
    getCategories(supabase),
    getNews(supabase, { publishedOnly: true, limit: 5 }),
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
        <style>{`
          .news-featured { transition: box-shadow .2s, transform .2s; }
          .news-featured:hover { box-shadow: 0 12px 40px rgba(0,0,0,.1); transform: translateY(-2px); }
          .news-sidebar-row { background: transparent; transition: background .12s; }
          .news-sidebar-row:hover { background: var(--surface-2) !important; }
          .news-footer-link { background: transparent; transition: background .12s; }
          .news-footer-link:hover { background: var(--surface-2) !important; }
          .news-view-all { transition: background .15s, border-color .15s; }
          .news-view-all:hover { background: var(--primary-soft) !important; border-color: var(--primary) !important; }

          @keyframes news-badge-ripple {
            0%   { box-shadow: 0 0 0 0 rgba(220,38,38,.55), 0 0 0 0 rgba(220,38,38,.25); }
            70%  { box-shadow: 0 0 0 8px rgba(220,38,38,0),  0 0 0 16px rgba(220,38,38,0); }
            100% { box-shadow: 0 0 0 0 rgba(220,38,38,0),   0 0 0 0  rgba(220,38,38,0); }
          }
          .news-new-badge {
            animation: news-badge-ripple 1.4s ease-out infinite;
            display: inline-flex;
          }
        `}</style>

        {/* Section header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 3, height: 44, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                News &amp; Announcements
              </div>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-.01em' }}>
                แจ้งข่าวสารห้องปฏิบัติการ
              </h2>
            </div>
          </div>
          <Link href="/news" className="news-view-all" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
            color: 'var(--primary)', textDecoration: 'none',
            border: '1.5px solid rgba(30,95,173,.2)', background: 'transparent',
          }}>
            ดูทั้งหมด <Icon name="arrowRight" size={12} />
          </Link>
        </div>

        {featuredNews.length > 0 && (() => {
          const featured = featuredNews[0]
          const sideNews = featuredNews.slice(1)
          const featCat = CAT_MAP[featured.cat as keyof typeof CAT_MAP]
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, alignItems: 'start' }}>

              {/* Featured card */}
              <Link href={`/news/${featured.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div className="news-featured" style={{
                  background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden',
                }}>
                  <div style={{ height: 4, background: featCat?.color ?? 'var(--primary)' }} />
                  <div style={{ padding: '26px 30px 28px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                      {featured.is_new && (
                        <span className="news-new-badge" style={{ background: '#DC2626', color: '#fff', fontSize: 9.5, fontWeight: 800, padding: '3px 8px', borderRadius: 4, letterSpacing: '.06em' }}>NEW</span>
                      )}
                      {featCat && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 600,
                          background: featCat.color + '15', color: featCat.color,
                          border: `1px solid ${featCat.color}22`,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: featCat.color }} />
                          {featCat.th}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {new Date(featured.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </span>
                    </div>
                    <h3 style={{ margin: '0 0 12px', fontSize: 22, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35, letterSpacing: '-.01em' }}>
                      {featured.title}
                    </h3>
                    {featured.excerpt && (
                      <p style={{
                        margin: '0 0 24px', fontSize: 14, color: 'var(--muted)', lineHeight: 1.75,
                        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {featured.excerpt}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                      {featured.author ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: (featCat?.color ?? 'var(--primary)') + '20',
                            color: featCat?.color ?? 'var(--primary)',
                            fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {featured.author.charAt(0).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12.5, color: 'var(--muted)', fontWeight: 500 }}>{featured.author}</span>
                        </div>
                      ) : <div />}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: featCat?.color ?? 'var(--primary)' }}>
                        อ่านต่อ <Icon name="arrowRight" size={12} />
                      </span>
                    </div>
                  </div>
                </div>
              </Link>

              {/* Sidebar list */}
              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden' }}>
                <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                    ข่าวสารล่าสุด
                  </span>
                </div>
                {sideNews.map((n, idx) => {
                  const cat = CAT_MAP[n.cat as keyof typeof CAT_MAP]
                  const isLast = idx === sideNews.length - 1
                  return (
                    <Link key={n.id} href={`/news/${n.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div className="news-sidebar-row" style={{
                        display: 'flex', borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      }}>
                        <div style={{ width: 3, flexShrink: 0, background: cat?.color ?? '#64748B' }} />
                        <div style={{ padding: '14px 16px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                            <span style={{
                              fontSize: 10.5, fontWeight: 700, padding: '1px 7px', borderRadius: 3,
                              background: (cat?.color ?? '#64748B') + '15', color: cat?.color ?? '#64748B',
                            }}>
                              {cat?.th ?? n.cat}
                            </span>
                            {n.is_new && (
                              <span style={{ background: '#DC2626', color: '#fff', fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3 }}>NEW</span>
                            )}
                            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 'auto' }}>
                              {new Date(n.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                          <div style={{
                            fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {n.title}
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
                <Link href="/news" style={{ display: 'block', textDecoration: 'none' }}>
                  <div className="news-footer-link" style={{
                    padding: '13px 18px', borderTop: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontSize: 12.5, fontWeight: 600, color: 'var(--primary)',
                  }}>
                    ดูข่าวสารทั้งหมด <Icon name="arrowRight" size={11} />
                  </div>
                </Link>
              </div>

            </div>
          )
        })()}
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
