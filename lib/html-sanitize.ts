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
