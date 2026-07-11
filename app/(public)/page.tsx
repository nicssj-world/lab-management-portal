import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { SETTINGS_DEFAULTS } from '@/lib/settings'
import { getCategories } from '@/lib/queries/categories'
import { getNews } from '@/lib/queries/news'
import { Card } from '@/components/ui/Card'
import { Icon } from '@/components/ui/Icon'
import { PublicHeroSearch } from '@/components/public/PublicHeroSearch'
import { CAT_MAP } from '@/lib/validations/news'

export default async function PublicHome() {
  const [categories, featuredNews, settingsRow] = await Promise.all([
    getCategories(supabaseAdmin).catch(() => []),
    getNews(supabaseAdmin, { publishedOnly: true, limit: 5 }).catch(() => []),
    supabaseAdmin.from('system_settings').select('standards').eq('id', 1).maybeSingle(),
  ])

  const standardsRaw = (settingsRow.data as { standards?: string } | null)?.standards ?? SETTINGS_DEFAULTS.standards
  const standards = standardsRaw.split(/[·,|]/).map((s: string) => s.trim()).filter(Boolean)

  const outLabCat = categories.find(c =>
    c.en?.toLowerCase().includes('out lab') || c.th?.includes('ตรวจพิเศษ')
  )
  const outLabUrl = outLabCat ? `/catalog?cat=${outLabCat.id}` : '/catalog'

  return (
    <main style={{ background: 'radial-gradient(circle at 18% 0%, var(--primary-soft) 0, transparent 34%), linear-gradient(180deg, var(--bg) 0%, var(--surface-2) 100%)' }}>
      <style>{`
        .public-hero { padding: 64px 28px 80px; }
        .public-hero:has(.public-hero-search-wrap.is-open) {
          overflow: visible !important;
        }
        .public-hero::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(112deg, rgba(255,255,255,.18) 0%, rgba(255,255,255,.07) 31%, transparent 58%),
            linear-gradient(78deg, rgba(7,23,49,.24) 0%, transparent 43%, rgba(255,255,255,.08) 100%),
            repeating-linear-gradient(135deg, rgba(255,255,255,.055) 0 1px, transparent 1px 22px);
          mix-blend-mode: soft-light;
          pointer-events: none;
        }
        .public-hero::after {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, transparent 0%, transparent 62%, rgba(7,23,49,.18) 100%),
            linear-gradient(rgba(255,255,255,.095) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.085) 1px, transparent 1px);
          background-size: auto, 48px 48px, 48px 48px;
          mask-image: linear-gradient(90deg, rgba(0,0,0,.5), rgba(0,0,0,.22) 56%, transparent 94%);
          pointer-events: none;
        }
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
        .public-hero-glow {
          position: absolute;
          border-radius: 999px;
          pointer-events: none;
          z-index: 0;
          filter: blur(1px);
          mix-blend-mode: screen;
        }
        .public-hero-glow-main {
          right: -120px;
          top: -92px;
          width: 540px;
          height: 540px;
          background:
            radial-gradient(circle at 42% 38%, rgba(255,255,255,.22), rgba(255,255,255,.085) 34%, rgba(255,255,255,0) 68%);
          opacity: .88;
        }
        .public-hero-glow-low {
          right: 182px;
          bottom: -140px;
          width: 360px;
          height: 360px;
          background:
            radial-gradient(circle at 50% 50%, rgba(176,141,87,.24), rgba(255,255,255,.07) 42%, rgba(255,255,255,0) 72%);
          opacity: .76;
        }
        .public-hero-glow-left {
          left: -210px;
          bottom: -190px;
          width: 460px;
          height: 460px;
          background:
            radial-gradient(circle at 50% 50%, rgba(255,255,255,.11), rgba(255,255,255,.04) 38%, rgba(255,255,255,0) 74%);
          opacity: .52;
        }
        .public-standard-badge {
          box-shadow: inset 0 1px 0 rgba(255,255,255,.22);
          transition: transform .16s ease, background .16s ease, border-color .16s ease;
        }
        .public-standard-badge:hover {
          transform: translateY(-1px);
          background: rgba(255,255,255,.24) !important;
          border-color: rgba(255,255,255,.42) !important;
        }
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
        .public-hero-search {
          display: flex;
          align-items: center;
          gap: 8px;
          width: min(100%, 520px);
          min-height: 48px;
          padding: 5px;
          border-radius: 14px;
          background: rgba(252,253,255,.97);
          border: 1px solid rgba(255,255,255,.82);
          box-shadow: 0 18px 52px rgba(11,22,38,.22), inset 0 1px 0 rgba(255,255,255,.8);
          transition: border-color .16s ease, box-shadow .16s ease, transform .16s ease;
        }
        .public-hero-search:focus-within {
          border-color: rgba(176,141,87,.55);
          box-shadow: 0 22px 62px rgba(11,22,38,.28), 0 0 0 4px rgba(176,141,87,.16), inset 0 1px 0 rgba(255,255,255,.86);
        }
        .public-hero-search-field {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 8px 0 12px;
          color: var(--primary);
        }
        .public-hero-search-input {
          width: 100%;
          min-height: 38px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #0F172A;
          font-size: 15px;
          font-family: inherit;
        }
        .public-hero-search-input::placeholder {
          color: #64748B;
        }
        .public-hero-cta,
        .manual-card {
          min-height: 44px;
          transition: transform .16s ease, box-shadow .16s ease, background .16s ease, border-color .16s ease;
          touch-action: manipulation;
        }
        .public-hero-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 38px rgba(11,22,38,.24);
        }
        .public-hero-secondary-links {
          display: flex;
          align-items: stretch;
          gap: 12px;
          margin-top: 20px;
          max-width: 560px;
        }
        .public-photo-stack {
          position: absolute;
          right: 0px;
          top: 50%;
          transform: translateY(-50%);
          width: 480px;
          height: 360px;
          z-index: 1;
        }
        .public-photo-card {
          position: absolute;
          overflow: hidden;
          border: 5px solid #fff;
          border-radius: 14px;
          background: #fff;
          box-shadow: 0 22px 54px rgba(11,22,38,.24);
          transition: transform .22s ease, box-shadow .22s ease;
        }
        .public-photo-card::after {
          content: "";
          position: absolute;
          inset: 0;
          border: 1px solid rgba(255,255,255,.55);
          border-radius: 9px;
          pointer-events: none;
        }
        .public-photo-card img {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
          filter: saturate(1.05) contrast(1.02);
        }
        .public-photo-card:hover {
          z-index: 20 !important;
          box-shadow: 0 34px 84px rgba(11,22,38,.36);
        }
        /* central lab — main card, centre of stack */
        .public-photo-central {
          left: 50%; top: 50%;
          transform: translate(-48%, -50%) rotate(-3deg);
          width: 300px; height: 178px;
          z-index: 4;
        }
        .public-photo-central:hover { transform: translate(-48%, -56%) rotate(-3deg) scale(1.04); }
        /* blood tube — bottom-right */
        .public-photo-blood {
          right: 8px; bottom: 18px;
          width: 148px; height: 96px;
          z-index: 6;
          transform: rotate(4deg);
        }
        .public-photo-blood:hover { transform: rotate(4deg) translateY(-8px) scale(1.05); }
        /* petri — bottom-left */
        .public-photo-petri {
          left: 8px; bottom: 18px;
          width: 158px; height: 104px;
          z-index: 5;
          transform: rotate(-2deg);
        }
        .public-photo-petri:hover { transform: rotate(-2deg) translateY(-8px) scale(1.05); }
        /* sign — top-right */
        .public-photo-sign {
          right: 28px; top: 18px;
          width: 152px; height: 86px;
          z-index: 3;
          transform: rotate(3deg);
        }
        .public-photo-sign:hover { transform: rotate(3deg) translateY(-8px) scale(1.05); }
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
          background: rgba(252,253,255,.96);
          color: var(--primary);
          border: 1px solid rgba(255,255,255,.72);
          box-shadow: 0 16px 38px rgba(11,22,38,.22), inset 0 1px 0 rgba(255,255,255,.8);
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .public-section { padding-left: 28px; padding-right: 28px; }
        .public-news-grid { grid-template-columns: 3fr 2fr; }
        .public-category-grid { grid-template-columns: repeat(4, 1fr); }
        .public-scope-card {
          border-color: var(--public-hairline) !important;
          box-shadow: var(--public-shadow-md);
          background:
            linear-gradient(135deg, var(--card) 0%, var(--card) 58%, var(--primary-soft) 100%) !important;
        }
        .public-scope-icon {
          box-shadow: inset 0 0 0 1px var(--public-hairline), var(--public-shadow-sm);
        }
        .public-category-card {
          min-height: 148px;
          border-color: var(--public-hairline) !important;
          box-shadow: 0 10px 26px rgba(11,22,38,.055);
        }
        .public-category-card:hover {
          transform: translateY(-2px);
          border-color: rgba(30,95,173,.28) !important;
          box-shadow: 0 18px 42px rgba(11,22,38,.10) !important;
        }
        .public-category-card-icon {
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.35);
          transition: transform .16s ease;
        }
        .public-category-card:hover .public-category-card-icon {
          transform: scale(1.05);
        }

        @media (max-width: 900px) {
          .public-hero { padding: 42px 20px 58px; }
          .public-hero-shell { min-height: 0; }
          .public-hero-text { max-width: none; }
          .public-photo-stack {
            position: relative;
            right: auto; top: auto;
            transform: none;
            width: 100%;
            height: 280px;
            margin-top: 28px;
          }
          .public-hero-glow-main {
            right: -180px;
            top: -130px;
            opacity: .68;
          }
          .public-hero-glow-low,
          .public-hero-glow-left {
            opacity: .42;
          }
          .public-photo-card { border-width: 4px; }
          .public-photo-central {
            left: 50%; top: 50%;
            transform: translate(-48%, -50%) rotate(-3deg);
            width: 56%; height: 150px;
          }
          .public-photo-central:hover { transform: translate(-48%, -56%) rotate(-3deg) scale(1.04); }
          .public-photo-blood {
            right: 4%; bottom: 14px;
            width: 30%; height: 84px;
          }
          .public-photo-petri {
            left: 4%; bottom: 14px;
            width: 32%; height: 90px;
          }
          .public-photo-sign {
            right: 6%; top: 14px;
            width: 30%; height: 72px;
          }
          .public-lab-sticker {
            left: 2px;
            bottom: 36px;
            font-size: 11.5px;
          }
          .public-hero-title { font-size: 34px !important; letter-spacing: 0 !important; }
          .public-hero-actions { flex-direction: column; align-items: stretch; max-width: 360px; }
          .public-hero-search-wrap { width: 100%; }
          .public-hero-search { width: 100%; }
          .public-hero-cta { width: 100%; justify-content: center; }
          .public-hero-secondary-links { flex-direction: column; max-width: 360px; }
          .line-card, .manual-card { width: 100%; box-sizing: border-box; }
          .public-section { padding-left: 20px !important; padding-right: 20px !important; }
          .public-news-grid { grid-template-columns: 1fr !important; }
          .public-category-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }

        @media (max-width: 520px) {
          .public-hero { padding: 36px 16px 48px; }
          .public-photo-stack { display: none; }
          .public-hero-glow-main {
            right: -240px;
            top: -170px;
            opacity: .52;
          }
          .public-hero-glow-low,
          .public-hero-glow-left {
            display: none;
          }
          .public-hero-title { font-size: 30px !important; line-height: 1.18 !important; }
          .public-hero-title-en::after { bottom: -5px; height: 2px; }
          .public-hero-copy { font-size: 14px !important; }
          .public-hero-search {
            align-items: stretch;
            flex-direction: column;
            padding: 8px;
          }
          .public-hero-search-field {
            min-height: 44px;
          }
          .public-section { padding-left: 16px !important; padding-right: 16px !important; }
          .public-category-grid { grid-template-columns: 1fr !important; }
        }
        .line-card {
          transition: background .18s, border-color .18s, transform .18s, box-shadow .18s;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.12);
        }
        .manual-card {
          transition: background .18s, border-color .18s, transform .18s, box-shadow .18s;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.14);
        }
        .line-card:hover,
        .manual-card:hover {
          background: rgba(255,255,255,.22) !important;
          border-color: rgba(255,255,255,.36) !important;
          transform: translateY(-1px);
          box-shadow: 0 14px 34px rgba(11,22,38,.18);
        }
        .public-hero a:focus-visible,
        .public-section a:focus-visible,
        .public-hero button:focus-visible,
        .public-section button:focus-visible {
          box-shadow: 0 0 0 3px rgba(255,255,255,.36), 0 0 0 6px var(--primary-soft);
          outline: none;
        }
        @media (prefers-reduced-motion: reduce) {
          .public-standard-badge,
          .public-hero-search,
          .public-hero-cta,
          .manual-card,
          .public-photo-card,
          .line-card,
          .news-featured,
          .news-sidebar-row,
          .news-footer-link,
          .news-view-all,
          .public-category-card,
          .public-category-card-icon {
            animation: none !important;
            transition: none !important;
          }
        }
      `}</style>
      {/* Hero */}
      <section
        className="public-hero"
        style={{
          background: 'linear-gradient(128deg, rgba(7,23,49,.22) 0%, transparent 42%), linear-gradient(135deg, #0E3F7E 0%, var(--primary) 50%, #2563EB 100%)',
          color: '#fff', position: 'relative', overflow: 'hidden',
        }}
      >
        <div className="public-hero-glow public-hero-glow-main" aria-hidden="true" />
        <div className="public-hero-glow public-hero-glow-low" aria-hidden="true" />
        <div className="public-hero-glow public-hero-glow-left" aria-hidden="true" />
        <div className="public-hero-shell">
          <div className="public-hero-text">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
              {standards.map((s: string) => (
                <span key={s} className="public-standard-badge" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 10px', borderRadius: 20,
                  background: 'rgba(255,255,255,.18)', color: '#fff',
                  border: '1px solid rgba(255,255,255,.25)',
                  fontSize: 11.5, fontWeight: 700,
                }}>
                  <Icon name="shieldCheck" size={12} />
                  {s}
                </span>
              ))}
            </div>
            <h1 className="public-hero-title" style={{ fontWeight: 700, margin: '0 0 18px', lineHeight: 1.15, letterSpacing: 0 }}>
              <span className="public-hero-title-th">คู่มือการส่งตรวจทางห้องปฏิบัติการ</span><br />
              <span className="public-hero-title-en">LABORATORY SERVICES</span>
            </h1>
            <p className="public-hero-copy" style={{ fontSize: 16, opacity: 0.9, marginTop: 0, lineHeight: 1.6, maxWidth: 520 }}>
              ค้นหารายการตรวจวิเคราะห์ คู่มือการเก็บตัวอย่าง และเอกสารแนบต่างๆ<br />ของกลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรีได้ที่นี่
            </p>
            <div className="public-hero-actions" style={{ marginTop: 24 }}>
              <PublicHeroSearch />
            </div>

            <div className="public-hero-secondary-links" aria-label="ช่องทางเสริม">
              {/* LINE Add Friend card */}
              <a
                href="https://line.me/R/ti/p/@759ksiuc"
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}
              >
                <div className="line-card" style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  minHeight: 100,
                  background: 'rgba(255,255,255,.13)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,.22)',
                  borderRadius: 14, padding: '12px 18px 12px 12px',
                }}>
                  {/* QR code */}
                  <div style={{
                    background: '#fff', borderRadius: 10, padding: 5,
                    flexShrink: 0, lineHeight: 0,
                  }}>
                    <img
                      src="https://qr-official.line.me/gs/M_759ksiuc_BW.png"
                      alt="LINE QR Code @759ksiuc"
                      width={64} height={64}
                      style={{ display: 'block', borderRadius: 6 }}
                    />
                  </div>
                  {/* Text */}
                  <div>
                    <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', marginBottom: 2, fontWeight: 500 }}>
                      ระบบตอบข้อมูลอัตโนมัติผ่าน LINE
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      {/* LINE icon */}
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#06C755">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                      </svg>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '.01em' }}>
                        @759ksiuc
                      </span>
                    </div>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: '#06C755', color: '#fff',
                      padding: '5px 12px', borderRadius: 999,
                      fontSize: 11.5, fontWeight: 700,
                    }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                      </svg>
                      เพิ่มเพื่อน
                    </div>
                  </div>
                </div>
              </a>
              <Link
                href="/manual"
                className="manual-card"
                style={{
                  textDecoration: 'none',
                  minHeight: 100,
                  minWidth: 214,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(255,255,255,.13)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,.22)',
                  borderRadius: 14,
                  padding: '14px 18px',
                  backdropFilter: 'blur(10px)',
                }}
              >
                <span style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'rgba(255,255,255,.16)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon name="book" size={21} />
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 10.5, color: 'rgba(255,255,255,.72)', fontWeight: 500 }}>
                    เปิดดูเอกสาร
                  </span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.25 }}>
                    คู่มือห้องปฏิบัติการ
                  </span>
                </span>
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
        <Card padding={28} className="public-scope-card">
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', marginBottom: 16 }}>
            <div
              className="public-scope-icon"
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
          .news-featured {
            border-color: var(--public-hairline) !important;
            box-shadow: 0 12px 30px rgba(11,22,38,.055);
            transition: box-shadow .2s, transform .2s, border-color .2s;
          }
          .news-featured:hover { box-shadow: 0 18px 48px rgba(11,22,38,.11); border-color: rgba(30,95,173,.28) !important; transform: translateY(-2px); }
          .news-sidebar-panel {
            border-color: var(--public-hairline) !important;
            box-shadow: 0 12px 30px rgba(11,22,38,.05);
          }
          .news-sidebar-row { background: transparent; transition: background .12s, transform .12s; }
          .news-sidebar-row:hover { background: var(--surface-2) !important; transform: translateX(2px); }
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
            border: '1.5px solid var(--public-hairline)', background: 'var(--card)',
            boxShadow: 'var(--public-shadow-sm)',
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
                  background: `linear-gradient(135deg, ${featCat?.color ?? 'var(--primary)'}0F, transparent 46%), var(--card)`, borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden',
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
              <div className="news-sidebar-panel" style={{ background: 'var(--card)', borderRadius: 14, border: '1px solid var(--border)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
              <Card hoverable padding={20} className="public-category-card">
                <div
                  className="public-category-card-icon"
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
