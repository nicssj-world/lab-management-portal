import Image from 'next/image'

interface HospitalLogoProps {
  height: number
  preload?: boolean
}

export function HospitalLogo({ height, preload = false }: HospitalLogoProps) {
  const width = height * 1.5

  return (
    <Image
      src="/images/logo-chonburi.png"
      alt="โรงพยาบาลชลบุรี"
      width={width}
      height={height}
      preload={preload}
      unoptimized
      style={{ width, height, flexShrink: 0, objectFit: 'contain' }}
    />
  )
}
