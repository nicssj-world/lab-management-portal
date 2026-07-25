import { z } from 'zod'

export const personAssignmentInputSchema = z.object({
  profileId: z.string().uuid(),
  assignmentType: z.enum(['primary', 'responsible']),
  spaceCode: z.string().min(1).max(100).nullable().default(null),
  zoneCode: z.string().min(1).max(100).nullable().default(null),
}).superRefine((value, context) => {
  if (Number(Boolean(value.spaceCode)) + Number(Boolean(value.zoneCode)) !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ต้องเลือกห้องหรือโซนอย่างใดอย่างหนึ่ง',
      path: ['spaceCode'],
    })
  }
})

export type PersonAssignmentInput = z.infer<typeof personAssignmentInputSchema>
