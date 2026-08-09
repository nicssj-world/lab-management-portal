import type { CSSProperties } from 'react'

export function GoogleMapEmbed({ latitude, longitude, nameTh, style }: {
  latitude: number | null | undefined
  longitude: number | null | undefined
  nameTh?: string
  style?: CSSProperties
}) {
  if (latitude == null || longitude == null) return null
  return (
    <iframe
      title={`แผนที่ ${nameTh ?? 'จุดรวมพล'}`}
      src={`https://www.google.com/maps?q=${latitude},${longitude}&z=19&output=embed`}
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      style={{ width: '100%', aspectRatio: '16/9', border: 0, borderRadius: 8, marginTop: 8, ...style }}
    />
  )
}
