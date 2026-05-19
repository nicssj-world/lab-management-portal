'use client'

import { useState, type ReactNode } from 'react'

interface Props {
  manualTab: ReactNode
  importTab: ReactNode
}

export function TabsClient({ manualTab, importTab }: Props) {
  const [tab, setTab] = useState<'manual' | 'import'>('manual')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 20px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    border: 'none',
    borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
    background: 'none',
    color: active ? 'var(--primary)' : 'var(--muted)',
    cursor: 'pointer',
    transition: 'all .15s',
  })

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 8px' }}>
        <button style={tabStyle(tab === 'manual')} onClick={() => setTab('manual')}>กรอกข้อมูลรายการ</button>
        <button style={tabStyle(tab === 'import')} onClick={() => setTab('import')}>นำเข้าจาก Excel</button>
      </div>
      {tab === 'manual' ? manualTab : importTab}
    </div>
  )
}
