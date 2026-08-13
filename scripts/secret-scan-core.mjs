const MODERN_SUPABASE_SECRET = /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{20,}\b/g
const PRIVATE_KEY = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g

function lineNumberAt(text, index) {
  let line = 1
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) line += 1
  }
  return line
}

function addMatches(findings, text, source, pattern, kind) {
  pattern.lastIndex = 0
  for (const match of text.matchAll(pattern)) {
    findings.push({ source, line: lineNumberAt(text, match.index ?? 0), kind })
  }
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
  } catch {
    return null
  }
}

export function scanText(text, source = '<input>') {
  const findings = []

  addMatches(findings, text, source, MODERN_SUPABASE_SECRET, 'Supabase secret API key')
  addMatches(findings, text, source, PRIVATE_KEY, 'Private key')

  JWT.lastIndex = 0
  for (const match of text.matchAll(JWT)) {
    const payload = decodeJwtPayload(match[0])
    if (payload?.role === 'service_role') {
      findings.push({
        source,
        line: lineNumberAt(text, match.index ?? 0),
        kind: 'Supabase legacy service_role JWT',
      })
    }
  }

  return findings
}
