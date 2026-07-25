'use client'

type AuthorizationMultiSelectOption = { value: string; label: string }

export function AuthorizationMultiSelect({
  label,
  options,
  value,
  onChange,
  emptyMessage = 'ไม่มีตัวเลือก',
}: {
  label: string
  options: AuthorizationMultiSelectOption[]
  value: string[]
  onChange: (value: string[]) => void
  emptyMessage?: string
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option])
  }

  return (
    <fieldset aria-label={label} style={{ margin: 0, padding: 10, border: '1px solid var(--border)', borderRadius: 8, display: 'flex', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
      {options.length === 0 ? (
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{emptyMessage}</span>
      ) : options.map((option) => {
        const selected = value.includes(option.value)
        return (
          <label key={option.value} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 9px', border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 7, cursor: 'pointer', background: selected ? 'var(--primary-soft)' : 'var(--card)', color: selected ? 'var(--primary)' : 'var(--ink)', fontSize: 12.5, fontWeight: selected ? 600 : 400 }}>
            <input type="checkbox" checked={selected} onChange={() => toggle(option.value)} style={{ accentColor: 'var(--primary)' }} />
            {option.label}
          </label>
        )
      })}
    </fieldset>
  )
}
