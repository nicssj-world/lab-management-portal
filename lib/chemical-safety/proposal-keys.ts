import type { JsonValue } from './types'

type KeyMapper = (key: string) => string

function mapProposalValue(value: unknown, mapKey: KeyMapper): unknown {
  if (Array.isArray(value)) return value.map(item => mapProposalValue(item, mapKey))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [mapKey(key), mapProposalValue(item, mapKey)]),
    )
  }
  return value
}

export function snakeProposal(value: Record<string, unknown>): Record<string, unknown> {
  return mapProposalValue(
    value,
    key => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`),
  ) as Record<string, unknown>
}

export function camelProposal(value: Record<string, unknown>): Record<string, JsonValue> {
  return mapProposalValue(
    value,
    key => key.replace(/_([a-z])/g, (_match, letter) => letter.toUpperCase()),
  ) as Record<string, JsonValue>
}
