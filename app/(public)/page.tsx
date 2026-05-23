import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getCategories } from '@/lib/queries/categories'
import { getNews } from '@/lib/queries/news'
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

  const outLabCat = categories.find(c =>
    c.en?.toLowerCase().includes('out lab') || c.th?.includes('ตรวจพิเศษ')
  )
  const outLabUrl = outLabCat ? `/catalog?cat=${outLabCat.id}` : '/catalog'

  return (
    <main style={{ background: 'var(--bg)' }}>
      <style>{`
        .public-hero { padding: 64px 28px 80px; }
        .public-hero-shell {
          max-width: 1280px;
          min-height: 360px;
          margin: 0 auto;
          position: relative;
        }
        .public-hero-text {
          position: relative;
          z-index: 2;
          max-width: 760px;
        }
        .public-hero-title { font-size: 44px; }
        .public-hero-title-th {
          display: inline-block;
          color: #fff;
          text-shadow: 0 10px 32px rgba(15,23,42,.22);
          animation: heroTitleRise .7s ease-out both;
        }
        .public-hero-title-en {
          display: inline-block;
          position: relative;
          margin-top: 4px;
          color: transparent;
          background: linear-gradient(90deg, #fff 0%, #dbeafe 38%, #fff 72%);
          background-size: 220% 100%;
          -webkit-background-clip: text;
          background-clip: text;
          text-shadow: none;
          animation: heroTitleRise .7s ease-out .08s both, heroTitleShine 4.8s ease-in-out 1s infinite;
        }
        .public-hero-title-en::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -7px;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(255,255,255,.85), rgba(219,234,254,.18));
          transform-origin: left;
          animation: heroUnderline .75s ease-out .28s both;
        }
        @keyframes heroTitleRise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroTitleShine {
          0%, 42% { background-position: 100% 50%; }
          72%, 100% { background-position: 0% 50%; }
        }
        @keyframes heroUnderline {
          from { opacity: 0; transform: scaleX(.25); }
          to { opacity: 1; transform: scaleX(1); }
        }
        .public-hero-actions { display: flex; gap: 12px; }
        .public-photo-stack {
          position: absolute;
          right: -8px;
          bottom: -28px;
          width: 470px;
          height: 315px;
          z-index: 1;
        }
        .public-photo-card {
          position: absolute;
          overflow: hidden;
          border: 5px solid #fff;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 20px 46px rgba(15,23,42,.22);
          transition: transform .22s ease, box-shadow .22s ease, z-index .22s ease;
        }
        .public-photo-card img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        .public-photo-card:hover {
          z-index: 20 !important;
          box-shadow: 0 30px 70px rgba(15,23,42,.34);
        }
        .public-photo-central {
          right: 58px;
          bottom: 64px;
          width: 336px;
          height: 190px;
          z-index: 4;
          transform: rotate(-3deg);
        }
        .public-photo-central:hover { transform: rotate(-3deg) translateY(-8px) scale(1.035); }
        .public-photo-blood {
          right: 2px;
          bottom: 28px;
          width: 164px;
          height: 106px;
          z-index: 6;
          transform: rotate(4deg);
        }
        .public-photo-blood:hover { transform: rotate(4deg) translateY(-8px) scale(1.045); }
        .public-photo-petri {
          right: 260px;
          bottom: 26px;
          width: 176px;
          height: 118px;
          z-index: 5;
          transform: rotate(2deg);
        }
        .public-photo-petri:hover { transform: rotate(2deg) translateY(-8px) scale(1.045); }
        .public-photo-sign {
          right: 286px;
          bottom: 198px;
          width: 168px;
          height: 92px;
          z-index: 3;
          transform: rotate(3deg);
        }
        .public-photo-sign:hover { transform: rotate(3deg) translateY(-8px) scale(1.045); }
        .public-lab-sticker {
          position: absolute;
          left: 18px;
          bottom: 46px;
          z-index: 12;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 11px;
          border-radius: 999px;
          background: rgba(255,255,255,.94);
          color: var(--primary);
          border: 1px solid rgba(255,255,255,.65);
          box-shadow: 0 16px 34px rgba(15,23,42,.2);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .public-section { padding-left: 28px; padding-right: 28px; }
        .public-news-grid { grid-template-columns: 3fr 2fr; }
        .public-category-grid { grid-template-columns: repeat(4, 1fr); }

        @media (max-width: 900px) {
          .public-hero { padding: 42px 20px 58px; }
          .public-hero-shell { min-height: 0; }
          .public-hero-text { max-width: none; }
          .public-photo-stack {
            position: relative;
            right: auto;
            bottom: auto;
            width: 100%;
            height: 272px;
            margin-top: 28px;
          }
          .public-photo-card { border-width: 5px; }
          .public-photo-central {
            right: 7%;
            bottom: 74px;
            width: 58%;
            height: 146px;
          }
          .public-photo-blood {
            right: 1%;
            bottom: 34px;
            width: 32%;
            height: 88px;
          }
          .public-photo-petri {
            right: 47%;
            bottom: 26px;
            width: 34%;
            height: 94px;
          }
          .public-photo-sign {
            right: 56%;
            bottom: 194px;
            width: 32%;
            height: 70px;
          }
          .public-lab-sticker {
            left: 2px;
            bottom: 36px;
            font-size: 11.5px;
          }
          .public-hero-title { font-size: 34px !important; letter-spacing: 0 !important; }
          .public-hero-actions { flex-direction: column; align-items: stretch; max-width: 360px; }
          .public-hero-actions a, .public-hero-actions button { width: 100%; justify-content: center; }
          .public-section { padding-left: 20px !important; padding-right: 20px !important; }
          .public-news-grid { grid-template-columns: 1fr !important; }
          .public-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }

        @media (max-width: 520px) {
          .public-hero { padding: 36px 16px 48px; }
          .public-photo-stack { display: none; }
          .public-hero-title { font-size: 30px !important; line-height: 1.18 !important; }
          .public-hero-title-en::after { bottom: -5px; height: 2px; }
          .public-hero-copy { font-size: 14px !important; }
          .public-section { padding-left: 16px !important; padding-right: 16px !important; }
          .public-category-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      {/* Hero */}
      <section
        className="public-hero"
        style={{
          background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-2) 100%)',
          color: '#fff', position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{ position: 'absolute', right: -80, top: -40, width: 460, height: 460, borderRadius: '50%', background: 'rgba(255,255,255,.06)' }} />
        <div style={{ position: 'absolute', right: 120, bottom: -100, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,.05)' }} />
        <div className="public-hero-shell">
          <div className="public-hero-text">
            <Badge color="blue" style={{ background: 'rgba(255,255,255,.18)', color: '#fff', marginBottom: 16, display: 'inline-flex' }}>
              ISO 15189:2022 · ISO 15190:2020 Accredited
            </Badge>
            <h1 className="public-hero-title" style={{ fontWeight: 700, margin: '0 0 18px', lineHeight: 1.15, letterSpacing: 0 }}>
              <span className="public-hero-title-th">คู่มือการส่งตรวจทางห้องปฏิบัติการ</span><br />
              <span className="public-hero-title-en">LABORATORY SERVICES</span>
            </h1>
            <p className="public-hero-copy" style={{ fontSize: 16, opacity: 0.9, marginTop: 0, lineHeight: 1.6, maxWidth: 520 }}>
              ค้นหารายการตรวจวิเคราะห์ คู่มือการเก็บตัวอย่าง และเอกสารแนบต่างๆ<br />ของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรีได้ที่นี่
            </p>
            <div className="public-hero-actions" style={{ marginTop: 24 }}>
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

          <div className="public-photo-stack" aria-label="ภาพห้องปฏิบัติการ">
            <div className="public-photo-card public-photo-sign">
              <img src="/images/hero-lab/medical-technology-sign.png" alt="ป้ายกลุ่มงานเทคนิคการแพทย์" />
            </div>
            <div className="public-photo-card public-photo-central">
              <img src="/images/hero-lab/central-laboratory.png" alt="Central Laboratory โรงพยาบาลชลบุรี" />
            </div>
            <div className="public-photo-card public-photo-petri">
              <img src="/images/hero-lab/microbiology-petri.jpg" alt="จานเพาะเชื้อ Microbiology" />
            </div>
            <div className="public-photo-card public-photo-blood">
              <img src="/images/hero-lab/blood-tube.webp" alt="หลอดเลือด close-up" />
            </div>
            
          </div>
        </div>
      </section>

      {/* Service scope */}
      <section className="public-section" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 3, height: 44, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Service Scope
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-.01em' }}>
              ขอบเขตการให้บริการ
            </h2>
          </div>
        </div>
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
            <br />ผู้รับบริการสามารถดูรายละเอียดตามรายการทดสอบที่หมวดหมู่{' '}
            <Link
              href={outLabUrl}
              style={{
                fontWeight: 700, color: 'var(--primary)',
                textDecoration: 'underline', textDecorationColor: 'rgba(30,95,173,.35)',
                textUnderlineOffset: 3,
              }}
            >
              ตรวจพิเศษและปฏิบัติการตรวจต่อ (OUT LAB)
            </Link>
          </p>
        </Card>
      </section>

      {/* News */}
      <section className="public-section" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 0' }}>
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
          const sideNews = featuredNews.slice(1, 4)
          const featCat = CAT_MAP[featured.cat as keyof typeof CAT_MAP]
          return (
            <div className="public-news-grid" style={{ display: 'grid', gap: 16, alignItems: 'stretch' }}>

              {/* Featured card */}
              <Link href={`/news/${featured.id}`} style={{ textDecoration: 'none', display: 'block', height: '100%' }}>
                <div className="news-featured" style={{
                  background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden',
                  height: '100%', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
                }}>
                  <div style={{ height: 4, background: featCat?.color ?? 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ padding: '26px 30px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 18, borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
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
              <div style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                <Link href="/news" style={{ display: 'block', textDecoration: 'none', marginTop: 'auto' }}>
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
      <section className="public-section" style={{ maxWidth: 1280, margin: '0 auto', padding: '56px 28px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{ width: 3, height: 44, borderRadius: 2, background: 'var(--primary)', flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 4 }}>
              Categories
            </div>
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: 'var(--ink)', lineHeight: 1, letterSpacing: '-.01em' }}>
              ค้นหารายการตรวจวิเคราะห์ตามหมวดหมู่
            </h2>
            <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 5 }}>
              รวม {categories.length} หมวดหมู่ทางห้องปฏิบัติการ
            </div>
          </div>
        </div>
        <div className="public-category-grid" style={{ display: 'grid', gap: 14 }}>
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
