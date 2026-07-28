'use client'

import { useEffect, useRef, useState } from 'react'
import { compressSafetyPhoto } from '@/lib/lab-map/safety-photo-compression'

export function SafetyPhotoPicker({ label, file, disabled = false, uploadPercent = null, onChange }: {
  label: string
  file: File | null
  disabled?: boolean
  uploadPercent?: number | null
  onChange: (file: File | null) => void
}) {
  const galleryInputRef = useRef<HTMLInputElement>(null)
  const [preparing, setPreparing] = useState(false)
  const [message, setMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  async function selectPhoto(source: File) {
    setPreparing(true)
    setMessage('กำลังลดขนาดรูปก่อนอัปโหลด…')
    try {
      const compressed = await compressSafetyPhoto(source)
      onChange(compressed.file)
      const savedPercent = source.size > 0
        ? Math.max(0, Math.round((1 - compressed.compressedBytes / source.size) * 100))
        : 0
      setMessage(`พร้อมอัปโหลด ${Math.round(compressed.compressedBytes / 1024)} KB${savedPercent > 0 ? ` · ลดขนาด ${savedPercent}%` : ''}`)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setPreparing(false)
    }
  }

  function fileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const source = event.target.files?.[0]
    event.target.value = ''
    if (source) void selectPhoto(source)
  }

  const locked = disabled || preparing
  return <section className="safety-photo-picker" aria-label={label}>
    <strong>{label}</strong>
    <div className="safety-photo-sources">
      <label aria-disabled={locked}>
        ถ่ายรูป
        <input type="file" accept="image/*" capture="environment" disabled={locked} onChange={fileSelected} />
      </label>
      <label aria-disabled={locked}>
        เลือกจากคลัง
        <input ref={galleryInputRef} type="file" accept="image/*" disabled={locked} onChange={fileSelected} />
      </label>
    </div>
    {previewUrl ? <div className="safety-photo-preview">
      <img src={previewUrl} alt="ตัวอย่างรูปหลักฐานก่อนบันทึก" />
      <div className="safety-photo-preview-actions">
        <button type="button" disabled={locked} onClick={() => galleryInputRef.current?.click()}>เปลี่ยนรูป</button>
        <button type="button" disabled={locked} onClick={() => { onChange(null); setMessage('เอารูปออกแล้ว') }}>เอารูปออก</button>
      </div>
    </div> : null}
    <small aria-live="polite">
      {preparing
        ? 'กำลังลดขนาดรูป…'
        : uploadPercent != null
          ? `กำลังอัปโหลด ${uploadPercent}%`
          : message || 'เลือกถ่ายรูปใหม่ หรือเลือกรูปจากคลังรูป'}
    </small>
  </section>
}
