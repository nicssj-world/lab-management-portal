'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { LabMapCanvas } from './LabMapCanvas'
import { LabMapPrintStyles } from './LabMapPrintStyles'
import { LabMapStyles } from './LabMapStyles'
import type { MapPrintDTO } from '@/lib/lab-map/print'

export function LabMapPrintSheet({ dto }: { dto: MapPrintDTO }) {
  const [qr, setQr] = useState('')
  useEffect(() => { QRCode.toDataURL(dto.webUrl, { width: 256, margin: 1 }).then(setQr).catch(() => setQr('')) }, [dto.webUrl])
  return (
    <article className="lab-map-shell lab-map-print-sheet" data-map-print-sheet data-paper-size={dto.paperSize}>
      <LabMapStyles />
      <LabMapPrintStyles paperSize={dto.paperSize} />
      {dto.watermark ? <div className="lab-map-print-watermark">{dto.watermark}</div> : null}
      <header className="lab-map-print-header">
        <div><h1>{dto.titleTh}</h1><p>กลุ่มงานเทคนิคการแพทย์ อาคารเฉลิมราชสมบัติ ชั้น 3 โรงพยาบาลชลบุรี</p></div>
        <div className="lab-map-print-badge"><strong>{dto.official ? 'ฉบับใช้งานจริง' : 'DRAFT PREVIEW'}</strong><br />{dto.release.versionCode}</div>
      </header>
      <div className="lab-map-print-you-are-here">★ ท่านอยู่ที่นี่: {dto.installationPoint}</div>
      <div className="lab-map-print-map">
        <LabMapCanvas map={dto.map} mode={dto.mode} selectedCode={null}
          activeRouteCodes={dto.activeRouteCodes} onSelect={() => {}} interactive={false} />
      </div>
      <footer className="lab-map-print-footer">
        <dl>
          <dt>มีผลวันที่</dt><dd>{dto.release.effectiveDate ?? 'ยังไม่กำหนด'}</dd>
          <dt>ผู้ทบทวน</dt><dd>{dto.release.reviewerName ?? dto.release.reviewedBy ?? 'ยังไม่กำหนด'}</dd>
          <dt>ผู้อนุมัติ</dt><dd>{dto.release.approverName ?? dto.release.approvedBy ?? 'ยังไม่กำหนด'}</dd>
          <dt>พิมพ์เมื่อ</dt><dd>{new Date(dto.printedAt).toLocaleString('th-TH')}</dd>
        </dl>
        <div className="lab-map-print-qr">{qr ? <img src={qr} alt="QR เปิดแผนที่บนเว็บไซต์" /> : null}<span>เว็บไซต์เป็นข้อมูลเสริม โปรดปฏิบัติตามป้ายฉบับอนุมัติที่ติดตั้งในพื้นที่</span></div>
      </footer>
    </article>
  )
}
