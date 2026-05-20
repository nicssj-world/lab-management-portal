# Frontend Design Skill — Lab Management Portal

You are helping design or refine UI for the Lab Management Portal. Apply the rules below exactly — do not deviate or introduce new patterns.

---

## Styling rules

**Inline styles only.** No Tailwind utility classes on custom components. No CSS modules. No styled-components.

Use CSS variables for every color and radius:

| Token | Value | Use for |
|---|---|---|
| `var(--bg)` | `#F7F9FC` | Page background |
| `var(--card)` | `#FFFFFF` | Card / panel background |
| `var(--surface-2)` | `#F1F4F9` | Table header, skeleton, hover |
| `var(--border)` | `#E5EAF0` | Borders, dividers |
| `var(--ink)` | `#0F172A` | Primary text |
| `var(--muted)` | `#64748B` | Secondary text, labels |
| `var(--primary)` | `#1E5FAD` | Active state, CTA |
| `var(--primary-soft)` | `rgba(30,95,173,.10)` | Hover fill, drag-over |
| `var(--danger)` | `#DC2626` | Destructive actions |
| `var(--success)` | `#16A34A` | Success states |
| `var(--warning)` | `#D97706` | Warning states |
| `var(--radius)` | `12px` | Card radius |

Dark mode works automatically via `[data-theme="dark"]` — never hardcode hex colors that aren't in the token list above.

---

## Component library — `components/ui/`

**Only use these. Do not install external UI libraries.**

### `<Button>`
```tsx
<Button variant="primary" | "secondary" | "danger" | "ghost" icon="upload" onClick={fn}>
  Label
</Button>
```
- `icon` accepts any key from the ICONS map (see below)

### `<Card>`
```tsx
<Card padding={24} style={{ maxWidth: 400 }}>…</Card>
<Card padding={0}>  {/* for tables — handles overflow internally */}
```

### `<Badge>`
```tsx
<Badge color="blue"|"teal"|"purple"|"amber"|"green"|"gray"|"red" size="sm"|"md" dot>
  Label
</Badge>
```
- `dot` prop adds a colored dot prefix (use for status/visibility)

### `<Icon>`
```tsx
<Icon name="..." size={16} stroke={1.5} style={{ color: 'var(--muted)' }} />
```
Available icon names: `home, flask, book, doc, dash, users, shield, chart, beaker, bell, search, filter, plus, download, upload, eye, edit, trash, check, x, arrowRight, arrowLeft, globe, lock, menu, chevDown, chevRight, alert, clock, trending, settings, logout, inbox, microscope, pill, building, blood, petri, shieldCheck, syringe, cup, droplet, bloodBag, dna, cell, biohazard, phone, mail, moon, sun`

### `<Input>`
```tsx
<Input icon="search" placeholder="..." value={val} onChange={(v: string) => setVal(v)} />
```
- `onChange` receives the string value directly — NOT a React event

### `<Select>`
```tsx
<Select value={v} onChange={(v) => setV(v)} options={[{ value, label }]} placeholder="..." />
```

### `<EmptyState>`
```tsx
<EmptyState icon="doc" title="ไม่มีข้อมูล" hint="คำอธิบายเพิ่มเติม" />
```

### `<PageHeader>`
```tsx
<PageHeader eyebrow="MODULE" title="หน้าชื่อ" subtitle="คำอธิบาย" actions={<Button>…</Button>} />
```

---

## Common UI patterns

### Page layout
Server component fetches + passes props → Client component renders. The staff layout provides sidebar + topbar; pages render into the content area (no extra wrapper needed).

### Pill tabs (type filter)
```tsx
// Outlined pills — active = gray fill, inactive = transparent + border
<button style={{
  padding: '5px 14px', borderRadius: 20, border: '1px solid var(--border)',
  background: active ? 'var(--surface-2)' : 'transparent',
  color: active ? 'var(--ink)' : 'var(--muted)',
  fontWeight: active ? 700 : 500, fontSize: 13,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
}}>
  {label} <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{count}</span>
</button>
```

### Filled pills (visibility / status filter)
```tsx
// Filled for active, outlined for inactive
<button style={{
  padding: '5px 16px', borderRadius: 20, border: '1px solid var(--border)',
  background: active ? 'var(--primary)' : 'transparent',
  color: active ? '#fff' : 'var(--ink)',
  fontWeight: 600, fontSize: 12.5,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
}}>
  {label}
</button>
```

### Table (plain HTML)
```tsx
<Card padding={0}>
  <div style={{ overflowX: 'auto' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
      <thead>
        <tr style={{ background: 'var(--surface-2)', textAlign: 'left' }}>
          {['COL A', 'COL B', ''].map((h, i) => (
            <th key={i} style={{
              padding: '11px 16px', fontSize: 11, fontWeight: 700,
              color: 'var(--muted)', letterSpacing: '.06em', textTransform: 'uppercase',
              borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
            }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}
            style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <td style={{ padding: '12px 16px' }}>…</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</Card>
```

### Loading skeleton rows
```tsx
{loading && Array.from({ length: 5 }).map((_, i) => (
  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
    {Array.from({ length: NUM_COLS }).map((_, j) => (
      <td key={j} style={{ padding: '14px 16px' }}>
        <div style={{ height: 14, borderRadius: 4, background: 'var(--surface-2)', width: j === 0 ? 200 : 80 }} />
      </td>
    ))}
  </tr>
))}
```

### Toast notifications
```tsx
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; ok: boolean }[]>([])
  const counter = useRef(0)
  const add = useCallback((msg: string, ok = true) => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])
  return { toasts, add }
}

// Render at bottom of JSX:
<div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
  {toasts.map((t) => (
    <div key={t.id} style={{
      padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: t.ok ? '#166534' : '#B91C1C', color: '#fff',
      boxShadow: '0 4px 16px rgba(0,0,0,.18)',
    }}>
      {t.ok ? '✓ ' : '✕ '}{t.msg}
    </div>
  ))}
</div>
```

### Action icon buttons (in table rows)
```tsx
// Neutral
<button title="แก้ไข" style={{
  width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
}}>
  <Icon name="edit" size={14} />
</button>

// Danger (delete)
<button title="ลบ" style={{
  width: 30, height: 30, borderRadius: 6, border: '1px solid #FEE2E2',
  background: 'transparent', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626',
}}>
  <Icon name="trash" size={14} />
</button>
```

### Modal overlay
```tsx
// Fixed overlay — do NOT close on outside click (removed per project feedback)
<div style={{
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)',
  zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
}}>
  <div style={{
    background: 'var(--card)', borderRadius: 16, width: '100%', maxWidth: 620,
    maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.25)',
  }}>
    {/* Header */}
    <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Modal Title</div>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, display: 'flex' }}>
        <Icon name="x" size={16} />
      </button>
    </div>
    {/* Body */}
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>…</div>
    {/* Footer */}
    <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
      <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--ink)' }}>ยกเลิก</button>
      <Button variant="primary" onClick={handleSave}>บันทึก</Button>
    </div>
  </div>
</div>
```

### Form fields inside modal
```tsx
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8,
  border: '1px solid var(--border)', fontSize: 13,
  fontFamily: 'inherit', color: 'var(--ink)',
  background: 'var(--card)', outline: 'none', boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--muted)', marginBottom: 4, display: 'block',
}
```

### Pagination
```tsx
<div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
  <div style={{ fontSize: 12, color: 'var(--muted)' }}>
    แสดง {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, count)} จาก {count} รายการ
  </div>
  <div style={{ display: 'flex', gap: 4 }}>
    {/* prev / page numbers / next buttons — same 30×30 pattern as action buttons */}
  </div>
</div>
```

---

## Language

This portal uses Thai (ภาษาไทย) for UI labels. Use `useLang()` from `context/LangContext.tsx` only when the component needs to toggle between `th` and `en`. Otherwise hardcode Thai directly.

---

## Things to avoid

- No Tailwind utility classes on custom components (only on raw HTML where necessary)
- No external component libraries (shadcn, MUI, Chakra, etc.)
- No `React Hook Form` — use controlled `useState` + plain `<input>`/`<select>`
- No `axios` — use `fetch`
- Do not close modals on outside-click (project decision: users must use the X button)
- Do not hardcode hex colors that aren't in the CSS variable list
- Do not add `onClick` close handler to modal overlays
