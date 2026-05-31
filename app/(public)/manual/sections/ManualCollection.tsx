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

interface Props { lang: Lang }

export function ManualCollection({ lang }: Props) {
  const [tab, setTab] = useState('overview')

  return (
    <Section>
      <H2 eyebrow="02 · Collection">
        {lang === 'th' ? 'การเก็บตัวอย่างส่งตรวจ' : 'Specimen Collection'}
      </H2>

      {/* Sub-tab switcher — underline style */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        borderBottom: '2px solid var(--border)',
        overflowX: 'auto', scrollbarWidth: 'none',
      }}>
        {COLLECTION_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '8px 14px',
                border: 'none',
                borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                marginBottom: -2,
                background: 'transparent',
                color: active ? 'var(--primary)' : 'var(--muted)',
                fontWeight: active ? 700 : 500,
                fontSize: 13,
                cursor: 'pointer',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
                transition: 'color .15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--ink)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--muted)' }}
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
    </Section>
  )
}
