import { z } from 'zod'

export const ROLES = ['Admin', 'Manager', 'Medical Technologist', 'Assistant'] as const

export const DEPARTMENTS = [
  'สำนักงานกลุ่มงานเทคนิคการแพทย์',
  'งานเคมีคลินิกและภูมิคุ้มกันวิทยาคลินิก',
  'งานโลหิตวิทยาคลินิกและจุลทรรศนศาสตร์คลินิก',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  'งานคลังเลือด',
  'งานจุลชีววิทยาและควบคุมกำกับงานคลังน้ำยา',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
  'งานบริการผู้ป่วยนอก',
] as const

export const DEPT_ABBR: Record<string, string> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': 'สำนักงาน',
  'งานเคมีคลินิกและภูมิคุ้มกันวิทยาคลินิก': 'เคมีคลินิก',
  'งานโลหิตวิทยาคลินิกและจุลทรรศนศาสตร์คลินิก': 'โลหิตวิทยา',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': 'ตรวจพิเศษ',
  'งานคลังเลือด': 'คลังเลือด',
  'งานจุลชีววิทยาและควบคุมกำกับงานคลังน้ำยา': 'จุลชีววิทยา',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี': 'PCU',
  'งานบริการผู้ป่วยนอก': 'ผู้ป่วยนอก',
}

export const createUserSchema = z.object({
  ephis_id: z
    .string()
    .min(1, 'กรุณากรอก E-Phis')
    .regex(/^\d+$/, 'E-Phis ต้องเป็นตัวเลขเท่านั้น'),
  name: z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร').max(100),
  role: z.enum(ROLES, { errorMap: () => ({ message: 'กรุณาเลือกบทบาท' }) }),
  dept: z.enum(DEPARTMENTS, { errorMap: () => ({ message: 'กรุณาเลือกแผนก' }) }),
})

export const updateUserSchema = z.object({
  ephis_id: z
    .string()
    .regex(/^\d+$/, 'E-Phis ต้องเป็นตัวเลขเท่านั้น')
    .optional()
    .or(z.literal('')),
  name: z.string().min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร').max(100).optional(),
  role: z.enum(ROLES).optional(),
  dept: z.enum(DEPARTMENTS).optional(),
  status: z.enum(['active', 'inactive', 'pending']).optional(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
