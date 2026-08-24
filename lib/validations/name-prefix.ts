import { z } from 'zod'
import { NAME_PREFIX_OPTIONS } from '@/lib/personnel/name'

export const namePrefixSchema = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? null : value,
  z.enum(NAME_PREFIX_OPTIONS).optional().nullable(),
)
