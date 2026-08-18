const INVALID_EXCEL_SHEET_CHARS = /[:\\/?*\[\]]/g
const MAX_SHEET_NAME_LENGTH = 31

export function getUniqueWorksheetName(rawName: string, usedNames: ReadonlySet<string>): string {
  const base = (rawName.replace(INVALID_EXCEL_SHEET_CHARS, '_').trim() || 'Sheet').slice(0, MAX_SHEET_NAME_LENGTH)
  const used = new Set([...usedNames].map((name) => name.toLowerCase()))
  if (!used.has(base.toLowerCase())) return base

  for (let suffix = 2; ; suffix += 1) {
    const suffixText = `_${suffix}`
    const candidate = `${base.slice(0, MAX_SHEET_NAME_LENGTH - suffixText.length)}${suffixText}`
    if (!used.has(candidate.toLowerCase())) return candidate
  }
}
