import type { EquipmentAreaLabel, EquipmentRect } from './types'

const MIN_LABEL_FONT_SIZE = 8
const MAX_DYNAMIC_LABEL_LINES = 4

const graphemeSegmenter = new Intl.Segmenter('th', { granularity: 'grapheme' })
const wordSegmenter = new Intl.Segmenter('th', { granularity: 'word' })

function graphemes(text: string): string[] {
  return [...graphemeSegmenter.segment(text)].map((part) => part.segment)
}

function graphemeLength(text: string): number {
  return [...graphemeSegmenter.segment(text)].length
}

function splitLongSegment(segment: string, maxCharacters: number): string[] {
  const parts = graphemes(segment)
  const chunks: string[] = []
  for (let index = 0; index < parts.length; index += maxCharacters) {
    chunks.push(parts.slice(index, index + maxCharacters).join(''))
  }
  return chunks
}

interface WrappedLabelText {
  lines: string[]
  hasSplitLongSegment: boolean
}

function wrapThaiText(text: string, maxCharacters: number): WrappedLabelText {
  const segments = [...wordSegmenter.segment(text.trim().replace(/\s+/g, ' '))].map((part) => part.segment)
  const lines: string[] = []
  let current = ''
  let hasSplitLongSegment = false

  for (const segment of segments) {
    const candidate = `${current}${segment}`
    if (graphemeLength(candidate.trim()) <= maxCharacters) {
      current = candidate
      continue
    }

    if (current.trim()) lines.push(current.trim())
    const cleanSegment = segment.trim()
    if (!cleanSegment) {
      current = ''
      continue
    }

    const chunks = splitLongSegment(cleanSegment, maxCharacters)
    if (chunks.length > 1) hasSplitLongSegment = true
    lines.push(...chunks.slice(0, -1))
    current = chunks.at(-1) ?? ''
  }

  if (current.trim()) lines.push(current.trim())
  return { lines, hasSplitLongSegment }
}

export function labelForRenamedArea(
  nameTh: string,
  rect: EquipmentRect,
  authoredLabel: EquipmentAreaLabel,
): EquipmentAreaLabel {
  for (let fontSize = authoredLabel.fontSize; fontSize >= MIN_LABEL_FONT_SIZE; fontSize -= 1) {
    const maxCharacters = Math.max(4, Math.floor(rect.width / (fontSize * 0.62)))
    const maxLines = Math.max(1, Math.min(MAX_DYNAMIC_LABEL_LINES, Math.floor(rect.height / (fontSize * 1.25))))
    const wrapped = wrapThaiText(nameTh, maxCharacters)
    if (!wrapped.hasSplitLongSegment && wrapped.lines.length <= maxLines) return { ...authoredLabel, lines: wrapped.lines, fontSize }
  }

  const maxCharacters = Math.max(4, Math.floor(rect.width / (MIN_LABEL_FONT_SIZE * 0.62)))
  return { ...authoredLabel, lines: wrapThaiText(nameTh, maxCharacters).lines, fontSize: MIN_LABEL_FONT_SIZE }
}
