import Image from 'next/image'
import { getPairedHospitalLogoOffset } from '@/lib/logo-layout'

interface HospitalLogoProps {
  height: number
  preload?: boolean
  compactWithNext?: boolean
}

export function HospitalLogo({ height, preload = false, compactWithNext = false }: HospitalLogoProps) {
  const width = height * 1.5

  return (
    <Image
      src="/images/logo-chonburi.png"
      alt="โรงพยาบาลชลบุรี"
      width={width}
      height={height}
      preload={preload}
      unoptimized
      style={{
        width,
        height,
        flexShrink: 0,
        objectFit: 'contain',
        marginRight: compactWithNext ? getPairedHospitalLogoOffset(height) : undefined,
      }}
    />
  )
}
