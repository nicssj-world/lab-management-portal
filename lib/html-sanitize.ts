const ALLOWED_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'code', 'div', 'em', 'font', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 's', 'span', 'strong', 'sub', 'sup', 'table',
  'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul',
  'circle', 'ellipse', 'g', 'line', 'path', 'polygon', 'polyline', 'rect', 'svg',
])

const VOID_TAGS = new Set(['br', 'hr', 'img'])

const GLOBAL_ATTRS = new Set([
  'aria-hidden',
  'aria-label',
  'class',
  'dir',
  'lang',
  'role',
  'style',
  'title',
])
const SVG_ATTRS = new Set([
  'cx',
  'cy',
  'd',
  'fill',
  'height',
  'points',
  'r',
  'rx',
  'ry',
  'stroke',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-width',
  'viewbox',
  'width',
  'x',
  'x1',
  'x2',
  'xmlns',
  'y',
  'y1',
  'y2',
])
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'title', 'style']),
  img: new Set(['src', 'alt', 'width', 'height', 'title', 'style']),
  font: new Set(['color', 'size', 'face', 'style']),
  svg: SVG_ATTRS,
  path: SVG_ATTRS,
  rect: SVG_ATTRS,
  circle: SVG_ATTRS,
  ellipse: SVG_ATTRS,
  line: SVG_ATTRS,
  polyline: SVG_ATTRS,
  polygon: SVG_ATTRS,
  g: SVG_ATTRS,
  table: new Set(['style']),
  th: new Set(['colspan', 'rowspan', 'style']),
  td: new Set(['colspan', 'rowspan', 'style']),
}

const BLOCKED_STYLE_PROPS = new Set(['behavior', '-moz-binding'])
const SVG_ATTR_CASE: Record<string, string> = {
  viewbox: 'viewBox',
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function isSafeUrl(value: string, attr: string): boolean {
  const trimmed = value.trim()
  const compact = trimmed.replace(/[\u0000-\u001F\u007F\s]+/g, '').toLowerCase()
  if (!compact) return false
  if (compact.startsWith('javascript:') || compact.startsWith('vbscript:') || compact.startsWith('file:')) return false

  if (attr === 'src' && compact.startsWith('data:')) {
    return /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=]+$/i.test(compact)
  }

  if (
    trimmed.startsWith('#')
    || trimmed.startsWith('/')
    || trimmed.startsWith('./')
    || trimmed.startsWith('../')
  ) {
    return true
  }

  try {
    const url = new URL(trimmed, 'https://local.invalid')
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol)
  } catch {
    return false
  }
}

function sanitizeStyle(value: string): string {
  if (/(?:url\s*\(|expression\s*\(|javascript:|@import|behavior\s*:)/i.test(value)) return ''

  const declarations: string[] = []
  for (const raw of value.split(';')) {
    const [rawProp, ...rawValue] = raw.split(':')
    const prop = (rawProp ?? '').trim().toLowerCase()
    const nextValue = rawValue.join(':').trim()
    if (!prop || !nextValue || BLOCKED_STYLE_PROPS.has(prop)) continue
    if (!/^(?:--)?[a-z0-9-]{1,80}$/i.test(prop)) continue
    if (nextValue.length > 500 || /[<>{}]/.test(nextValue)) continue
    declarations.push(`${prop}: ${nextValue}`)
  }
  return declarations.join('; ')
}

function sanitizeAttrs(tag: string, rawAttrs: string): string {
  const allowed = TAG_ATTRS[tag] ?? GLOBAL_ATTRS
  const attrs: string[] = []
  const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g
  let match: RegExpExecArray | null

  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const rawName = match[1].toLowerCase()
    const name = SVG_ATTR_CASE[rawName] ?? rawName
    if (name.startsWith('on')) continue
    if (!rawName.startsWith('data-') && !rawName.startsWith('aria-') && !allowed.has(rawName) && !GLOBAL_ATTRS.has(rawName)) continue

    const rawValue = match[2]
    if (!rawValue) continue
    const value = rawValue.replace(/^["']|["']$/g, '')
    if (value.length > 5000) continue

    if ((name === 'href' || name === 'src') && !isSafeUrl(value, name)) continue
    if (name === 'target' && value !== '_blank') continue
    if ((name === 'width' || name === 'height' || name === 'colspan' || name === 'rowspan') && !/^\d{1,4}$/.test(value)) continue

    if (name === 'style') {
      const cleanStyle = sanitizeStyle(value)
      if (!cleanStyle) continue
      attrs.push(`style="${escapeAttr(cleanStyle)}"`)
      continue
    }

    attrs.push(`${name}="${escapeAttr(value)}"`)
  }

  if (tag === 'a' && attrs.some(attr => attr.startsWith('target="_blank"'))) {
    const hasRel = attrs.some(attr => attr.startsWith('rel='))
    if (!hasRel) attrs.push('rel="noopener noreferrer"')
  }

  return attrs.length ? ` ${attrs.join(' ')}` : ''
}

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return ''

  const withoutBlockedBlocks = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>/gi, '')

  return withoutBlockedBlocks.replace(/<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g, (_full, closing: string, tagName: string, rawAttrs: string) => {
    const tag = tagName.toLowerCase()
    if (!ALLOWED_TAGS.has(tag)) return ''
    if (closing) return VOID_TAGS.has(tag) ? '' : `</${tag}>`
    return `<${tag}${sanitizeAttrs(tag, rawAttrs)}${VOID_TAGS.has(tag) ? ' />' : '>'}`
  })
}

/**
 * Renders rich text (from the WYSIWYG editor) as plain text for surfaces that can't render
 * HTML at all (e.g. LINE bot text replies) — strips tags instead of allow-listing them.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return ''
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/[ \t]+/g, ' ')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const INLINE_ALLOWED = new Set(['strong', 'em', 'br'])
const INLINE_VOID = new Set(['br'])

/**
 * Strict inline sanitizer for single-cell rich text (manual table cells).
 * Allows only <strong>, <em>, <br>; drops all attributes and other tags
 * (keeping their text). Blocked block-level content is removed entirely.
 */
export function sanitizeInlineHtml(html: string | null | undefined): string {
  if (!html) return ''
  const withoutBlocked = String(html)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option)\b[^>]*>/gi, '')

  return withoutBlocked.replace(/<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g, (_full, closing: string, tagName: string) => {
    const tag = tagName.toLowerCase()
    if (!INLINE_ALLOWED.has(tag)) return ''
    if (closing) return INLINE_VOID.has(tag) ? '' : `</${tag}>`
    return INLINE_VOID.has(tag) ? '<br />' : `<${tag}>`
  })
}

/**
 * The meeting summary editor intentionally has a smaller surface than the
 * general rich-text renderer above. Keep this allow-list separate so a new
 * document/editor feature cannot accidentally widen what meeting summaries
 * can persist.
 */
export const MEETING_SUMMARY_MAX_TEXT_LENGTH = 2000
export const MEETING_SUMMARY_MAX_HTML_LENGTH = 12000

const MEETING_SUMMARY_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'span', 'br', 'div', 'p', 'font'])
const MEETING_SUMMARY_BLOCKED_TAGS = 'script|style|iframe|object|embed|link|meta|base|form|input|button|textarea|select|option|title|head|html|body'
const MEETING_SUMMARY_COLOR_NAMES = new Set([
  'black', 'silver', 'gray', 'white', 'maroon', 'red', 'purple', 'fuchsia', 'green', 'lime',
  'olive', 'yellow', 'navy', 'blue', 'teal', 'aqua', 'orange', 'aliceblue', 'rebeccapurple',
  'transparent', 'currentcolor',
])

function meetingSummaryColor(value: string | null | undefined): string | null {
  const color = value?.trim().toLowerCase() ?? ''
  if (!color || color.length > 64 || /[;{}<>]/.test(color)) return null
  if (/^#[0-9a-f]{3,4}$|^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(color)) return color
  if (/^(?:rgb|rgba)\(\s*(?:\d{1,3}%?\s*,\s*){2}\d{1,3}%?(?:\s*,\s*(?:0|1|0?\.\d+|100%))?\s*\)$/i.test(color)) return color
  if (/^(?:hsl|hsla)\(\s*\d{1,3}(?:\.\d+)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+|100%))?\s*\)$/i.test(color)) return color
  return MEETING_SUMMARY_COLOR_NAMES.has(color) ? color : null
}

function meetingSummaryAttrValue(rawAttrs: string, wanted: string): string | null {
  const attrRegex = /([a-zA-Z0-9:-]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    if (match[1].toLowerCase() !== wanted) continue
    const rawValue = match[2]
    if (!rawValue) return null
    return rawValue.replace(/^['"]|['"]$/g, '')
  }
  return null
}

function meetingSummaryStyleColor(rawStyle: string | null): string | null {
  if (!rawStyle) return null
  for (const declaration of rawStyle.split(';')) {
    const separator = declaration.indexOf(':')
    if (separator < 0) continue
    const property = declaration.slice(0, separator).trim().toLowerCase()
    if (property !== 'color') continue
    const color = meetingSummaryColor(declaration.slice(separator + 1))
    if (color) return color
  }
  return null
}

function meetingSummaryColorAttr(rawAttrs: string, tag: string): string | null {
  const styleColor = meetingSummaryStyleColor(meetingSummaryAttrValue(rawAttrs, 'style'))
  if (styleColor) return styleColor
  return tag === 'font' ? meetingSummaryColor(meetingSummaryAttrValue(rawAttrs, 'color')) : null
}

/**
 * Sanitize the compact inline HTML emitted by MeetingSummaryEditor. Plain
 * text is intentionally preserved, including its newlines, for old rows that
 * were stored before the editor existed.
 */
export function sanitizeMeetingSummaryHtml(html: string | null | undefined): string {
  if (!html) return ''
  const source = String(html).slice(0, MEETING_SUMMARY_MAX_HTML_LENGTH)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(new RegExp(`<\\s*(${MEETING_SUMMARY_BLOCKED_TAGS})\\b[\\s\\S]*?<\\s*\\/\\s*\\1\\s*>`, 'gi'), '')
    .replace(new RegExp(`<\\s*\\/?\\s*(${MEETING_SUMMARY_BLOCKED_TAGS})\\b[^>]*>`, 'gi'), '')

  return source.replace(/<\s*(\/?)\s*([a-zA-Z0-9-]+)([^>]*)>/g, (_full, closing: string, tagName: string, rawAttrs: string) => {
    const tag = tagName.toLowerCase()
    if (!MEETING_SUMMARY_TAGS.has(tag)) return ''
    if (closing) return tag === 'br' ? '' : `</${tag === 'b' ? 'strong' : tag === 'i' ? 'em' : tag === 'font' ? 'span' : tag}>`
    if (tag === 'br') return '<br />'
    if (tag === 'b' || tag === 'strong') return '<strong>'
    if (tag === 'i' || tag === 'em') return '<em>'
    if (tag === 'u' || tag === 'div' || tag === 'p') return `<${tag}>`
    const color = meetingSummaryColorAttr(rawAttrs, tag)
    return color ? `<span style="color: ${escapeAttr(color)}">` : '<span>'
  })
}

/** Return the safe stored form, or null-equivalent empty HTML for blank text. */
export function normalizeMeetingSummaryHtml(html: string | null | undefined): string {
  const safe = sanitizeMeetingSummaryHtml(html)
  return htmlToPlainText(safe).trim() ? safe : ''
}
