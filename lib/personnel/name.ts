export const NAME_PREFIX_OPTIONS = ['นาย', 'น.ส.', 'นาง'] as const
export type NamePrefix = typeof NAME_PREFIX_OPTIONS[number]

export function formatProfileName(name: string | null | undefined, prefix: string | null | undefined): string {
  const normalizedName = name?.trim() ?? ''
  const normalizedPrefix = prefix?.trim() ?? ''
  return `${normalizedPrefix}${normalizedName}`.trim()
}
