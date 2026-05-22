import Image from 'next/image'

interface LogoProps {
  size?: number
  showText?: boolean
  lang?: 'th' | 'en'
}

export function Logo({ size = 32, showText = true, lang = 'th' }: LogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 }}>
      <Image
        src="/images/logo-chonburi.png"
        alt="โรงพยาบาลชลบุรี"
        width={size}
        height={size}
        priority
        quality={100}
        style={{ borderRadius: 8, flexShrink: 0, objectFit: 'contain' }}
      />
      {showText && (
        <div style={{ lineHeight: 1.1, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lang === 'th' ? 'กลุ่มงานเทคนิคการแพทย์' : 'Medical Technology'}
          </div>
          <div style={{ fontSize: 10.5, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {lang === 'th' ? 'โรงพยาบาลชลบุรี' : 'Chonburi Hospital · MN-LAB-01'}
          </div>
        </div>
      )}
    </div>
  )
}
