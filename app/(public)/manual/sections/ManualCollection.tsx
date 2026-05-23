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

      {/* Sub-tab switcher */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, padding: 4, background: 'var(--surface-2)', borderRadius: 10 }}>
        {COLLECTION_TABS.map((t) => {
          const active = t.id === tab
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '7px 12px', borderRadius: 7, border: 'none',
                background: active ? 'var(--card)' : 'transparent',
                color: active ? 'var(--primary)' : 'var(--muted)',
                fontWeight: active ? 700 : 500, fontSize: 12.5,
                cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: active ? '0 1px 2px rgba(15,23,42,.08)' : 'none',
                transition: 'all .15s',
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
    </Section>
  )
}
