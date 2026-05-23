'use client'

import { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLang } from '@/context/LangContext'
import { MANUAL_SECTIONS, PHONE_DIRECTORY } from './data'
import { ManualHome } from './sections/ManualHome'
import { ManualCollection } from './sections/ManualCollection'
import { ManualTransport } from './sections/ManualTransport'
import { ManualAddon } from './sections/ManualAddon'
import { ManualReport } from './sections/ManualReport'
import { ManualOutLab } from './sections/ManualOutLab'

export function ManualShell() {
  const { lang } = useLang()
  const [activeSection, setActiveSection] = useState('home')

  function goSection(id: string) {
    setActiveSection(id)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const idx = MANUAL_SECTIONS.findIndex((s) => s.id === activeSection)
  const prev = idx > 0 ? MANUAL_SECTIONS[idx - 1] : null
  const next = idx < MANUAL_SECTIONS.length - 1 ? MANUAL_SECTIONS[idx + 1] : null

  return (
    <>
      <style>{`
        .manual-nav-btn { transition: background .15s, color .15s, transform .15s !important; }
        .manual-nav-btn:not(.manual-nav-active):hover {
          background: var(--primary-soft) !important;
          color: var(--ink) !important;
          transform: translateX(3px);
        }
      `}</style>
      {/* Page header strip */}
      <div style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 28px 24px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            MN-LAB-01 · พ.ศ. 2569 · Rev. 13
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, color: 'var(--ink)', letterSpacing: '-.01em', margin: 0 }}>
            {lang === 'th' ? 'คู่มือการใช้บริการห้องปฏิบัติการ' : 'Laboratory Services Manual'}
          </h1>
          <p style={{ margin: '8px 0 0', color: 'var(--muted)', fontSize: 14, maxWidth: 760, lineHeight: 1.6 }}>
            {lang === 'th'
              ? 'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี — แนวทางปฏิบัติสำหรับการเก็บสิ่งส่งตรวจ และรายงานผลตัวอย่างทางห้องปฏิบัติการ'
              : 'Medical Technology Department, Chonburi Hospital — procedures for collection, transport, testing, and reporting of laboratory specimens.'}
          </p>
        </div>
      </div>

      {/* Two-column grid */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 28px 60px', display: 'grid', gridTemplateColumns: '260px 1fr', gap: 28, alignItems: 'start' }}>

        {/* Sidebar */}
        <aside style={{ position: 'sticky', top: 88 }}>
          {/* Section nav */}
          <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase', padding: '8px 10px 4px' }}>
              {lang === 'th' ? 'สารบัญ' : 'Contents'}
            </div>
            {MANUAL_SECTIONS.map((s) => {
              const active = s.id === activeSection
              return (
                <button
                  key={s.id}
                  onClick={() => goSection(s.id)}
                  className={active ? 'manual-nav-btn manual-nav-active' : 'manual-nav-btn'}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    padding: '10px 12px', borderRadius: 8, border: 'none',
                    background: active ? 'var(--primary-soft)' : 'transparent',
                    color: active ? 'var(--primary)' : 'var(--ink)',
                    fontWeight: active ? 600 : 500, fontSize: 13,
                    lineHeight: 1.35, cursor: 'pointer', fontFamily: 'inherit',
                    textAlign: 'left', width: '100%',
                  }}
                >
                  <Icon name={s.icon} size={16} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span>{lang === 'th' ? s.th : s.en}</span>
                </button>
              )
            })}
          </div>

          {/* Phone directory */}
          <div style={{ marginTop: 14, padding: 14, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.55 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)', fontWeight: 700, fontSize: 12.5, marginBottom: 8 }}>
              <Icon name="phone" size={13} style={{ color: 'var(--primary)' }} />
              {lang === 'th' ? 'เบอร์โทรภายใน' : 'Internal extensions'}
            </div>
            {PHONE_DIRECTORY.map(({ label, ext }, i) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: i < PHONE_DIRECTORY.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span>{label}</span>
                <strong style={{ color: 'var(--ink)', fontFamily: '"IBM Plex Mono",monospace' }}>{ext}</strong>
              </div>
            ))}
          </div>
        </aside>

        {/* Content area */}
        <div style={{ minWidth: 0 }}>
          {activeSection === 'home'       && <ManualHome lang={lang} goto={goSection} />}
          {activeSection === 'collection' && <ManualCollection lang={lang} />}
          {activeSection === 'transport'  && <ManualTransport lang={lang} />}
          {activeSection === 'addon'      && <ManualAddon lang={lang} />}
          {activeSection === 'report'     && <ManualReport lang={lang} />}
          {activeSection === 'outlab'     && <ManualOutLab lang={lang} />}

          {/* Prev / Next navigation */}
          {(prev || next) && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              {prev ? (
                <button
                  onClick={() => goSection(prev.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <Icon name="arrowLeft" size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{lang === 'th' ? 'ก่อนหน้า' : 'Previous'}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>{lang === 'th' ? prev.th : prev.en}</div>
                  </div>
                </button>
              ) : <div />}
              {next ? (
                <button
                  onClick={() => goSection(next.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--card)', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right', justifyContent: 'flex-end', transition: 'all .15s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)' }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
                >
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{lang === 'th' ? 'ถัดไป' : 'Next'}</div>
                    <div style={{ fontSize: 13.5, color: 'var(--ink)', fontWeight: 600, marginTop: 2 }}>{lang === 'th' ? next.th : next.en}</div>
                  </div>
                  <Icon name="arrowRight" size={16} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                </button>
              ) : <div />}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
