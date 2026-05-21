import { z } from 'zod'

export const ROLES = ['Admin', 'Manager', 'Medical Technologist', 'Assistant', 'Document Controller', 'Medical Science Technician'] as const

export const DEPARTMENTS = [
  'สำนักงานกลุ่มงานเทคนิคการแพทย์',
  'งานเคมีคลินิก',
  'งานโลหิตวิทยาคลินิก',
  'งานภูมิคุ้มกันวิทยาคลินิก',
  'งานจุลทรรศนศาสตร์คลินิก',
  'งานอณูชีววิทยา',
  'งานจุลชีววิทยา',
  'งานคลังเลือด',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ',
  'งานบริการผู้ป่วยนอก',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี',
] as const

export const DEPT_ABBR: Record<string, string> = {
  'สำนักงานกลุ่มงานเทคนิคการแพทย์': 'Office',
  'งานเคมีคลินิก': 'CHEMISTRY',
  'งานโลหิตวิทยาคลินิก': 'HEMATOLOGY',
  'งานภูมิคุ้มกันวิทยาคลินิก': 'IMMUNOLOGY',
  'งานจุลทรรศนศาสตร์คลินิก': 'MICROSCOPY',
  'งานอณูชีววิทยา': 'BIOMOLECULAR',
  'งานจุลชีววิทยา': 'MICROBIOLOGY',
  'งานคลังเลือด': 'BLOODBANK',
  'งานตรวจพิเศษและห้องปฏิบัติการตรวจต่อ': 'OUTLAB',
  'งานบริการผู้ป่วยนอก': 'OPD',
  'ห้องปฏิบัติการศูนย์สุขภาพชุมชนเมืองชลบุรี': 'MCPCC',
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
