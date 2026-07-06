'use client'

import { useState } from 'react'
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

interface Props { lang: Lang }

export function ManualCollection({ lang }: Props) {
  const [tab, setTab] = useState('overview')

  return (
    <Section>
      <H2 eyebrow="02 · Collection">
        {lang === 'th' ? 'การเก็บตัวอย่างส่งตรวจ' : 'Specimen Collection'}
      </H2>

      {/* Collection tab switcher */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 22,
        padding: 6, background: 'linear-gradient(180deg, var(--surface-2), rgba(241,245,249,.72))',
        borderRadius: 12, border: '1px solid var(--border)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.75)',
      }}>
        {COLLECTION_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button key={t.id} onClick={() => setTab(t.id)} aria-pressed={active}
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

      {tab === 'overview'     && <CollectionOverview lang={lang} />}
      {tab === 'venipuncture' && <CollectionVenipuncture lang={lang} />}
      {tab === 'skin'         && <CollectionSkin lang={lang} />}
      {tab === 'abg'          && <CollectionBloodGas lang={lang} />}
      {tab === 'coag'         && <CollectionCoag lang={lang} />}
      {tab === 'micro'        && <CollectionMicro lang={lang} />}
      {tab === 'urine'        && <CollectionUrine lang={lang} />}
      {tab === 'stool'        && <CollectionStool lang={lang} />}
    </Section>
  )
}
