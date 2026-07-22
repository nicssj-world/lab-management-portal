'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

/**
 * เก็บค่าตัวกรองไว้ใน URL แทน useState
 *
 * ทำให้ปุ่มย้อนกลับของเบราว์เซอร์ทำงาน คัดลอกลิงก์ให้เพื่อนแล้วเห็นมุมมองเดียวกัน
 * และการ์ด KPI บนหน้าภาพรวมลิงก์มาที่รายการที่กรองไว้แล้วได้
 *
 * ค่าที่เท่ากับ default จะถูกลบออกจาก URL เพื่อไม่ให้ query string รกโดยไม่จำเป็น
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = searchParams.get(String(key))
      if (value !== null) result[key] = value as T[keyof T]
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const setFilters = useCallback((patch: Partial<T>, options?: { resetPage?: boolean }) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === defaults[key]) params.delete(key)
      else params.set(key, String(value))
    }
    // เปลี่ยนตัวกรองแล้วต้องกลับไปหน้าแรกเสมอ ไม่งั้นจะค้างอยู่หน้าที่ไม่มีข้อมูล
    if (options?.resetPage !== false && !('page' in patch)) params.delete('page')

    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router, searchParams])

  return { filters, setFilters }
}

/**
 * ช่องค้นหาที่หน่วงก่อนยิง เพื่อไม่ให้พิมพ์ทีละตัวอักษรแล้วยิง request ทุกครั้ง
 *
 * ตาม pattern ใน CLAUDE.md: หน่วง 350ms ตอนพิมพ์ แต่ล้างค่าให้มีผลทันที (0ms)
 * เพื่อให้กดล้างแล้วรายการเต็มกลับมาโดยไม่ต้องรอ
 */
export function useDebouncedSearch(initial: string, onCommit: (value: string) => void) {
  const [text, setText] = useState(initial)

  // ค่าจาก URL เปลี่ยนจากทางอื่น (กดย้อนกลับ, กดลิงก์ KPI) ต้องตามให้ทัน
  useEffect(() => { setText(initial) }, [initial])

  useEffect(() => {
    if (text === initial) return
    const timer = setTimeout(() => onCommit(text), text ? 350 : 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])

  return [text, setText] as const
}
