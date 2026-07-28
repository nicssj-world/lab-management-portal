'use client'

import { useEffect, useRef, useState } from 'react'

interface BarcodeResult { rawValue: string }
interface BarcodeDetectorInstance { detect(source: ImageBitmapSource): Promise<BarcodeResult[]> }
interface BarcodeDetectorConstructor {
  new(options?: { formats?: string[] }): BarcodeDetectorInstance
  getSupportedFormats?(): Promise<string[]>
}

export function SafetyAssetScanner({ active, onCode }: { active: boolean; onCode: (code: string) => void }) {
  const [code, setCode] = useState('')
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)

  function stopScanner() {
    if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  useEffect(() => {
    if (!active) stopScanner()
    return stopScanner
  }, [active])

  async function startScanner() {
    setError('')
    const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector
    if (!Detector) {
      setError('โทรศัพท์นี้ไม่รองรับการสแกนอัตโนมัติ กรุณากรอกรหัสอุปกรณ์')
      return
    }
    try {
      const supported = await Detector.getSupportedFormats?.() ?? []
      const formats = ['qr_code', 'code_128'].filter(format => supported.length === 0 || supported.includes(format))
      if (formats.length === 0) throw new Error('ไม่รองรับ QR หรือ Code 128')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      streamRef.current = stream
      if (!videoRef.current) throw new Error('ไม่พบหน้าต่างกล้อง')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)
      const detector = new Detector({ formats })
      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) return
        try {
          const results = await detector.detect(videoRef.current)
          const detected = results[0]?.rawValue.trim()
          if (detected) {
            setCode(detected)
            stopScanner()
            onCode(detected)
            return
          }
        } catch {
          // บางเฟรมยังอ่านไม่ได้ ให้ลองเฟรมถัดไปจนกว่าผู้ใช้จะยกเลิก
        }
        frameRef.current = requestAnimationFrame(() => void scanFrame())
      }
      frameRef.current = requestAnimationFrame(() => void scanFrame())
    } catch (reason) {
      stopScanner()
      setError(`เปิดกล้องไม่สำเร็จ: ${(reason as Error).message} กรุณากรอกรหัสอุปกรณ์`)
    }
  }

  function openByCode() {
    const normalized = code.trim()
    if (!normalized) {
      setError('กรุณากรอกรหัสอุปกรณ์')
      return
    }
    onCode(normalized)
  }

  return <section className="safety-asset-scanner" aria-label="ค้นหาอุปกรณ์ด้วยรหัส">
    <label>กรอกรหัสอุปกรณ์
      <input value={code} onChange={event => setCode(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') openByCode() }} />
    </label>
    <div>
      <button type="button" onClick={openByCode}>เปิดอุปกรณ์</button>
      <button type="button" onClick={scanning ? stopScanner : () => void startScanner()}>{scanning ? 'ยกเลิกสแกน' : 'สแกนรหัส'}</button>
    </div>
    <video ref={videoRef} hidden={!scanning} playsInline muted aria-label="ภาพจากกล้องสำหรับสแกนรหัส" />
    {error ? <p role="alert">{error}</p> : null}
  </section>
}
