'use client'

import Link from 'next/link'
import { Logo } from '@/components/lab/Logo'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'

const FOOTER_COLS = [
  {
    th: 'บริการ', en: 'Services',
    links: [
      { th: 'คู่มือห้องปฏิบัติการ', en: 'Lab Manual', href: '/manual' },
      { th: 'รายการตรวจวิเคราะห์',  en: 'Test Catalog', href: '/catalog' },
      { th: 'ข่าวสาร',               en: 'News', href: '/news' },
    ],
  },

  {
    th: 'ติดต่อ', en: 'Contact',
    links: [
      { th: 'โทร 038-931-455',        en: 'Tel. 038-931-455', href: '/contact' },
      { th: 'เวลาทำการ 08:00–16:00',  en: 'Hours 08:00–16:00', href: '/contact' },
      { th: 'Facebook',    en: 'Facebook', href: 'https://www.facebook.com/medtechcbh' },
    ],
  },
]

export function PublicFooter() {
  const { lang } = useLang()
  return (
    <footer
      className="public-footer"
      style={{
        background: 'var(--surface-2)',
        borderTop: '1px solid var(--border)',
        padding: '42px 28px 28px',
        marginTop: 60,
      }}
    >
      <style>{`
        .public-footer-grid {
          grid-template-columns: minmax(0, 1.6fr) minmax(180px, .75fr) minmax(260px, 1fr);
          align-items: start;
        }
        .public-footer-links {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .public-footer-bottom {
          flex-direction: row;
          align-items: center;
        }
        .public-footer-link {
          transition: color .15s, background .15s, transform .15s;
        }
        .public-footer-link:hover {
          color: var(--primary) !important;
          background: var(--primary-soft) !important;
          transform: translateX(2px);
        }

        @media (max-width: 767px) {
          .public-footer {
            margin-top: 40px !important;
            padding: 28px 16px calc(28px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .public-footer-grid {
            grid-template-columns: 1fr !important;
            gap: 18px !important;
          }
          .public-footer-brand {
            padding: 18px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--card);
          }
          .public-footer-brand p {
            margin-bottom: 0 !important;
          }
          .public-footer-col {
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: 14px;
            background: var(--card);
          }
          .public-footer-col-title {
            margin-bottom: 10px !important;
            font-size: 13px !important;
          }
          .public-footer-links {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px !important;
          }
          .public-footer-contact .public-footer-links {
            grid-template-columns: 1fr !important;
          }
          .public-footer-link {
            display: flex;
            align-items: center;
            min-height: 38px;
            padding: 9px 10px;
            border-radius: 10px;
            background: var(--surface-2);
            color: var(--ink) !important;
            line-height: 1.35;
            word-break: normal;
            overflow-wrap: anywhere;
          }
          .public-footer-bottom {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px;
            margin-top: 18px !important;
            padding-top: 14px !important;
            line-height: 1.5;
          }
        }
      `}</style>
      <div
        className="public-footer-grid"
        style={{
          maxWidth: 1280, margin: '0 auto',
          display: 'grid', gap: 32,
        }}
      >
        <div className="public-footer-brand">
          <Logo size={56} lang={lang} />
          <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.7 }}>
            {lang === 'th'
              ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี ให้บริการตรวจวิเคราะห์ทางห้องปฏิบัติการที่ได้มาตรฐาน'
              : 'Medical Technology Department, Chonburi Hospital. Accredited laboratory services certified under ISO 15189:2022 and ISO 15190:2020 standards.'}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700 }}>
              <Icon name="shieldCheck" size={13} />
              ISO 15189:2022
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 20, background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--primary)', fontSize: 11.5, fontWeight: 700 }}>
              <Icon name="shieldCheck" size={13} />
              ISO 15190:2020
            </span>
          </div>
        </div>
        {FOOTER_COLS.map((col) => (
          <div key={col.en} className={`public-footer-col ${col.en === 'Contact' ? 'public-footer-contact' : ''}`}>
            <div className="public-footer-col-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 800, color: 'var(--ink)', marginBottom: 12 }}>
              <span style={{ width: 4, height: 18, borderRadius: 2, background: 'var(--primary)', display: 'inline-block' }} />
              {lang === 'th' ? col.th : col.en}
            </div>
            <ul className="public-footer-links" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {col.links.map((link) => (
                <li key={link.en}>
                  <Link
                    className="public-footer-link"
                    href={link.href}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px',
                      borderRadius: 8,
                      fontSize: 12.5,
                      color: 'var(--muted)',
                      textDecoration: 'none',
                      lineHeight: 1.45,
                    }}
                  >
                    <Icon
                      name={col.en === 'Contact' ? (link.en.includes('Facebook') ? 'globe' : link.en.includes('Hours') ? 'clock' : 'phone') : 'chevRight'}
                      size={13}
                      style={{ color: 'var(--primary)', flexShrink: 0 }}
                    />
                    {lang === 'th' ? link.th : link.en}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div
        className="public-footer-bottom"
        style={{
          maxWidth: 1280, margin: '24px auto 0', padding: '16px 0 0',
          borderTop: '1px solid var(--border)', fontSize: 11.5, color: 'var(--muted)',
          display: 'flex', justifyContent: 'space-between',
        }}
      >
        <span>© 2026 Chonburi Hospital — Medical Technology Department.</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="doc" size={12} />
          v1.0.0 · MN-LAB-01
        </span>
      </div>
    </footer>
  )
}
