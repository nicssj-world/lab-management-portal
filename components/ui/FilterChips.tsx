'use client'

export interface FilterChipItem<T extends string> {
  value: T
  label: string
  count?: number
  disabled?: boolean
  color?: string
}

interface FilterChipsProps<T extends string> {
  items: readonly FilterChipItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  compact?: boolean
}

export function FilterChips<T extends string>({ items, value, onChange, label, compact = false }: FilterChipsProps<T>) {
  return (
    <div aria-label={label} className={`filter-chips${compact ? ' filter-chips-compact' : ''}`}>
      <style>{`
        .filter-chips{display:flex;max-width:100%;gap:6px;overflow-x:auto;scrollbar-width:thin}
        .filter-chip{display:inline-flex;min-height:44px;flex:0 0 auto;align-items:center;gap:7px;padding:7px 14px;border:1px solid var(--border);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:600;white-space:nowrap;cursor:pointer;transition:color .18s ease,background .18s ease,border-color .18s ease,box-shadow .18s ease}
        .filter-chip:hover:not(:disabled){color:var(--ink);border-color:color-mix(in srgb,var(--primary) 45%,var(--border));background:var(--surface-2)}
        .filter-chip[aria-pressed="true"]{color:var(--ink);border-color:color-mix(in srgb,var(--primary) 35%,var(--border));background:var(--primary-soft);box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--primary) 16%,transparent)}
        .filter-chip:focus-visible{outline:3px solid color-mix(in srgb,var(--primary) 32%,transparent);outline-offset:2px}
        .filter-chip:disabled{cursor:not-allowed;opacity:.5}.filter-chip-count{min-width:22px;padding:1px 7px;border-radius:999px;background:var(--card);font-size:11px;text-align:center}
        .filter-chips-compact .filter-chip{min-height:44px;padding:5px 12px;font-size:12px}
        @media(prefers-reduced-motion:reduce){.filter-chip{transition:none}}
      `}</style>
      {items.map((item) => (
        <button key={item.value} type="button" aria-pressed={value === item.value} disabled={item.disabled} className="filter-chip" onClick={() => onChange(item.value)}>
          {item.color && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: item.color, opacity: value === item.value ? 1 : .65 }} />}
          <span>{item.label}</span>
          {typeof item.count === 'number' && <span className="filter-chip-count">{item.count}</span>}
        </button>
      ))}
    </div>
  )
}
