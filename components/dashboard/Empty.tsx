import { Icon } from '@/components/ui/Icon'

export function Empty({ text, icon = 'check' }: { text: string; icon?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '26px 0', color: 'var(--muted)' }}>
      <div style={{ opacity: .3, marginBottom: 8 }}><Icon name={icon} size={20} /></div>
      <div style={{ fontSize: 12.5 }}>{text}</div>
    </div>
  )
}
