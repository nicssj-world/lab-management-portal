import { readFile } from 'fs/promises'
import path from 'path'
import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'

const RED = rgb(0.86, 0.15, 0.15)

// Bakes a diagonal "OBSOLETE / ยกเลิกใช้งาน" watermark into every page of an official PDF
// when a document transitions to Obsolete (ISO 15189 8.3 — prevent unintended use of
// obsolete documents). Obsolete is a terminal status (see lib/documents/transitions.ts),
// so the stamp is permanent; the pre-stamp file key is kept by the caller for recovery.
export async function stampObsoleteWatermark(
  pdfBytes: Uint8Array | ArrayBuffer,
  obsoleteDateText: string,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })
  pdf.registerFontkit(fontkit)

  const helveticaBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  // Thai subtitle uses the same bundled font as the revision-history pages; fall back to
  // English-only if the font can't be loaded (StandardFonts can't render Thai glyphs).
  const thaiFont = await readFile(
    path.join(process.cwd(), 'node_modules', 'font-th-sarabun-new', 'fonts', 'THSarabunNew_bold-webfont.ttf'),
  )
    .catch(() => readFile(path.join(
      process.cwd(), 'node_modules', '@fontsource', 'noto-sans-thai', 'files', 'noto-sans-thai-thai-700-normal.woff',
    )))
    .then((bytes) => pdf.embedFont(bytes))
    .catch(() => null)

  const mainText = 'OBSOLETE'
  const subText = thaiFont ? `ยกเลิกใช้งาน ${obsoleteDateText}` : `Cancelled ${obsoleteDateText}`
  const subFont = thaiFont ?? helveticaBold

  for (const page of pdf.getPages()) {
    const { width, height } = page.getSize()
    // Scale the watermark to the page's diagonal so it fits portrait and landscape alike.
    const mainSize = Math.min(width, height) / 5.2
    const subSize = mainSize / 3
    const mainWidth = helveticaBold.widthOfTextAtSize(mainText, mainSize)
    const subWidth = subFont.widthOfTextAtSize(subText, subSize)
    const angle = degrees(45)
    const cos = Math.SQRT1_2
    const sin = Math.SQRT1_2

    // Center the rotated baseline on the page center: start half the text length back
    // along the rotated direction.
    const cx = width / 2
    const cy = height / 2
    page.drawText(mainText, {
      x: cx - (mainWidth / 2) * cos,
      y: cy - (mainWidth / 2) * sin,
      size: mainSize,
      font: helveticaBold,
      color: RED,
      opacity: 0.28,
      rotate: angle,
    })
    // Subtitle sits below the main line (perpendicular offset in rotated space).
    const gap = mainSize * 0.75
    page.drawText(subText, {
      x: cx - (subWidth / 2) * cos + gap * sin,
      y: cy - (subWidth / 2) * sin - gap * cos,
      size: subSize,
      font: subFont,
      color: RED,
      opacity: 0.3,
      rotate: angle,
    })
  }

  return pdf.save()
}
