export interface RawTable { h: string[]; r: string[][] }

export function decodeTable(v: string | null | undefined): RawTable | null {
  if (!v) return null
  try {
    const p = JSON.parse(v)
    if (Array.isArray(p.r)) return p as RawTable
  } catch {}
  return null
}

export function isJsonTable(v: string | null | undefined): boolean {
  return decodeTable(v) !== null
}
