'use client'

import Image from 'next/image'
import { HospitalLogo } from '@/components/lab/HospitalLogo'
import { useSettings } from '@/context/SettingsContext'

interface LogoProps {
  size?: number
  showText?: boolean
  lang?: 'th' | 'en'
  variant?: 'public' | 'staff'
}

export function Logo({ size = 32, showText = true, lang = 'th', variant = 'public' }: LogoProps) {
  const { settings } = useSettings()
  const title = variant === 'staff'
    ? settings.systemCode
    : (lang === 'th' ? 'กลุ่มงานเทคนิคการแพทย์' : 'Medical Technology')
  const subtitle = variant === 'staff'
    ? settings.siteName
    : (lang === 'th' ? 'โรงพยาบาลชลบุรี' : `Chonburi Hospital · ${settings.siteName}`)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 1, minWidth: 0 }}>
      <HospitalLogo height={size} preload compactWithNext />
      <Image
        src="/images/cbh-lab-logo-v3.png"
        alt="CBH Lab"
        width={size}
        height={size}
        preload
        quality={100}
        sizes={`${size}px`}
        style={{ width: size, height: size, borderRadius: 8, flexShrink: 0, objectFit: 'contain' }}
      />
      {showText && (
        <div style={{ lineHeight: 1.1, whiteSpace: 'nowrap', minWidth: 0, overflow: 'hidden' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {title}
          </div>
          <div style={{ fontSize: 14, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {subtitle}
          </div>
        </div>
      )}
    </div>
  )
}
