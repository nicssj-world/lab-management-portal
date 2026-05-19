'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import type { WorkloadSummaryRow } from '@/lib/queries/workload'

interface Props {
  year: number
  summary: WorkloadSummaryRow[]
  chartRef: React.RefObject<HTMLDivElement | null>
}

export function AnnualReportExport({ year, summary, chartRef }: Props) {
  const [exporting, setExporting] = useState(false)

  async function handleExport() {
    if (exporting) return
    setExporting(true)
    try {
      const html2canvasLib = await import('html2canvas')
      const html2canvas = html2canvasLib.default
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const { sarabunBase64 } = await import('@/lib/fonts/sarabun-base64')

      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      doc.addFileToVFS('Sarabun-Regular.ttf', sarabunBase64)
      doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal')
      doc.setFont('Sarabun')

      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const now = new Date()
      const dateStr = now.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })

      // Page 1 — header + summary table
      doc.setFontSize(18)
      doc.setFont('Sarabun', 'normal')
      doc.text(`รายงานภาระงานประจำปีงบประมาณ ${year}`, pageW / 2, 18, { align: 'center' })

      doc.setFontSize(11)
      doc.text('กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี', pageW / 2, 25, { align: 'center' })
      doc.setFontSize(9)
      doc.text(`สร้างเมื่อ ${dateStr}`, pageW / 2, 31, { align: 'center' })

      const totalTests = summary.reduce((s, d) => s + d.total_count, 0)
      const totalInTime = summary.reduce((s, d) => s + d.in_time_count, 0)
      const overallPct = totalTests > 0 ? Math.round(totalInTime / totalTests * 100 * 10) / 10 : 0

      autoTable(doc, {
        startY: 37,
        head: [['แผนก', 'ตาม TAT', 'ทั้งหมด', '% on-time', 'สถานะ']],
        body: [
          ...summary.map(d => [
            d.dept_name,
            d.in_time_count.toLocaleString(),
            d.total_count.toLocaleString(),
            `${d.pct}%`,
            d.pct >= 95 ? 'ผ่าน' : d.pct >= 80 ? 'ควรปรับปรุง' : 'ไม่ผ่าน',
          ]),
          ['รวมทั้งหมด', totalInTime.toLocaleString(), totalTests.toLocaleString(), `${overallPct}%`, ''],
        ],
        styles: { font: 'Sarabun', fontSize: 10 },
        headStyles: { fillColor: [30, 95, 173], textColor: 255, fontStyle: 'normal' },
        alternateRowStyles: { fillColor: [241, 244, 249] },
        columnStyles: { 3: { halign: 'center' }, 4: { halign: 'center' } },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === 4) {
            const v = String(data.cell.raw)
            if (v === 'ผ่าน') data.cell.styles.textColor = [22, 163, 74]
            if (v === 'ไม่ผ่าน') data.cell.styles.textColor = [220, 38, 38]
            if (v === 'ควรปรับปรุง') data.cell.styles.textColor = [217, 119, 6]
          }
          if (data.section === 'body' && data.row.index === summary.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })

      // Page 2 — trend chart image
      if (chartRef.current) {
        try {
          doc.addPage()
          doc.setFontSize(14)
          doc.text('Trend รายเดือน', pageW / 2, 16, { align: 'center' })
          const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' })
          const imgData = canvas.toDataURL('image/png')
          const imgW = pageW - 40
          const imgH = (canvas.height / canvas.width) * imgW
          doc.addImage(imgData, 'PNG', 20, 22, imgW, Math.min(imgH, pageH - 40))
        } catch {
          // chart capture optional — skip if it fails
        }
      }

      doc.save(`workload-report-${year}.pdf`)
    } catch (e) {
      console.error('PDF export failed:', e)
      alert('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleExport} disabled={exporting}>
      {exporting ? 'กำลังสร้าง PDF...' : 'ส่งออกรายงานประจำปี'}
    </Button>
  )
}
