import { StepList } from '../../_primitives'
import { Icon } from '@/components/ui/Icon'
import { type Lang } from '../../data'
import { STOOL_STEPS_EN } from '../collection-data'

interface Props { lang: Lang }

const NOTES_EN = [
  'Do not collect stool directly from the toilet bowl.',
  'If the stool contains mucus or blood, include that abnormal portion in the sample.',
  'Do not use tissue paper to collect the stool sample.',
]

export function CollectionStool({ lang }: Props) {
  return (
    <div>
      <h3 style={{
        margin: '0 0 12px', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)',
        paddingBottom: 8, borderBottom: '1px solid var(--border)',
      }}>
        {lang === 'th' ? 'วิธีการเก็บอุจจาระ' : 'Stool Collection Procedure'}
      </h3>

      {lang === 'en' && (
        <>
          <StepList steps={STOOL_STEPS_EN} />

          <div style={{
            marginTop: 16,
            border: '1px solid rgba(217,119,6,.28)',
            borderLeft: '3px solid #D97706',
            borderRadius: 10,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px',
              background: 'rgba(217,119,6,.08)',
              borderBottom: '1px solid rgba(217,119,6,.18)',
            }}>
              <div style={{ color: '#D97706', display: 'flex', alignItems: 'center' }}>
                <Icon name="alert" size={13} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#B45309', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Notes
              </span>
            </div>
            <div style={{ padding: '6px 0', background: 'rgba(217,119,6,.04)' }}>
              {NOTES_EN.map((note, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '7px 16px 7px 14px',
                  borderBottom: i < NOTES_EN.length - 1 ? '1px solid rgba(217,119,6,.1)' : 'none',
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#D97706', flexShrink: 0, marginTop: 5 }} />
                  <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65 }}>{note}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
        <img
          src="/images/stool.png"
          alt={lang === 'th' ? 'อินโฟกราฟิกวิธีการเก็บอุจจาระ' : 'Stool collection procedure infographic'}
          style={{
            maxWidth: 400,
            width: '100%',
            borderRadius: 14,
            boxShadow: '0 4px 20px rgba(15,23,42,.12)',
            border: '1px solid var(--border)',
            display: 'block',
          }}
        />
      </div>
    </div>
  )
}
