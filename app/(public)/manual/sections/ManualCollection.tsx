'use client'

import { useRef, useState, type KeyboardEvent } from 'react'
import { H2, Section } from '../_primitives'
import { COLLECTION_TABS, type Lang } from '../data'
import { CollectionOverview } from './collection/CollectionOverview'
import { CollectionVenipuncture } from './collection/CollectionVenipuncture'
import { CollectionSkin } from './collection/CollectionSkin'
import { CollectionBloodGas } from './collection/CollectionBloodGas'
import { CollectionCoag } from './collection/CollectionCoag'
import { CollectionMicro } from './collection/CollectionMicro'
import { CollectionUrine } from './collection/CollectionUrine'
import { CollectionStool } from './collection/CollectionStool'
import { CollectionSemen } from './collection/CollectionSemen'

interface Props { lang: Lang }

export function ManualCollection({ lang }: Props) {
  const [tab, setTab] = useState('overview')
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([])

  function moveTab(index: number, direction: -1 | 1 | 0) {
    const nextIndex = direction === 0
      ? index
      : (index + direction + COLLECTION_TABS.length) % COLLECTION_TABS.length
    const nextId = COLLECTION_TABS[nextIndex]?.id
    if (!nextId) return
    setTab(nextId)
    tabRefs.current[nextIndex]?.focus()
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault(); moveTab(index, 1)
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault(); moveTab(index, -1)
    } else if (event.key === 'Home') {
      event.preventDefault(); moveTab(0, 0)
    } else if (event.key === 'End') {
      event.preventDefault(); moveTab(COLLECTION_TABS.length - 1, 0)
    }
  }

  return (
    <Section>
      <H2 eyebrow="02 · Collection">
        {lang === 'th' ? 'การเก็บตัวอย่างส่งตรวจ' : 'Specimen Collection'}
      </H2>

      {/* Collection tab switcher */}
      <div role="tablist" aria-label={lang === 'th' ? 'หัวข้อการเก็บตัวอย่าง' : 'Specimen collection topics'} style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 132px), 1fr))', gap: 6, marginBottom: 22,
        padding: 6, background: 'linear-gradient(180deg, var(--surface-2), rgba(241,245,249,.72))',
        borderRadius: 12, border: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
      }}>
        {COLLECTION_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button key={t.id} id={`collection-tab-${t.id}`} role="tab" aria-selected={active} aria-controls="collection-panel" tabIndex={active ? 0 : -1} ref={node => { tabRefs.current[indexOfTab(t.id)] = node }} onClick={() => setTab(t.id)} onKeyDown={event => handleTabKey(event, indexOfTab(t.id))}
              style={{
                position: 'relative',
                minWidth: 0,
                minHeight: 48,
                padding: '8px 6px',
                borderRadius: 8,
                border: active ? '1px solid rgba(30,95,173,.24)' : '1px solid transparent',
                background: active ? 'var(--card)' : 'rgba(255,255,255,.28)',
                color: active ? 'var(--ink)' : '#496179',
                fontWeight: active ? 700 : 600, fontSize: 11.5,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 4px 12px rgba(15,23,42,.08), inset 0 3px 0 var(--primary)' : 'inset 0 1px 0 rgba(255,255,255,.45)',
                transition: 'background .15s, border-color .15s, box-shadow .15s, color .15s',
                lineHeight: 1.2,
                textAlign: 'center',
                overflowWrap: 'normal',
                wordBreak: 'keep-all',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,.55)'
                  e.currentTarget.style.color = 'var(--ink)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'rgba(255,255,255,.28)'
                  e.currentTarget.style.color = '#496179'
                }
              }}
            >
              {lang === 'th' ? t.th : t.en}
            </button>
          )
        })}
      </div>

      <div id="collection-panel" role="tabpanel" aria-labelledby={`collection-tab-${tab}`} tabIndex={0}>
        {tab === 'overview'     && <CollectionOverview lang={lang} />}
        {tab === 'venipuncture' && <CollectionVenipuncture lang={lang} />}
        {tab === 'skin'         && <CollectionSkin lang={lang} />}
        {tab === 'abg'          && <CollectionBloodGas lang={lang} />}
        {tab === 'coag'         && <CollectionCoag lang={lang} />}
        {tab === 'micro'        && <CollectionMicro lang={lang} />}
        {tab === 'urine'        && <CollectionUrine lang={lang} />}
        {tab === 'stool'        && <CollectionStool lang={lang} />}
        {tab === 'semen'        && <CollectionSemen lang={lang} />}
      </div>
    </Section>
  )
}

function indexOfTab(id: string) {
  return COLLECTION_TABS.findIndex(tab => tab.id === id)
}
