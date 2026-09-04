'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const latestQueryRef = useRef(searchParams.toString())

  const filters = useMemo(() => {
    const result = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const value = searchParams.get(String(key))
      if (value !== null) result[key] = value as T[keyof T]
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  useEffect(() => {
    latestQueryRef.current = searchParams.toString()
  }, [pathname, searchParams])

  const setFilters = useCallback((patch: Partial<T>, options?: { resetPage?: boolean }) => {
    const params = new URLSearchParams(latestQueryRef.current)
    for (const [key, value] of Object.entries(patch)) {
      if (!value || value === defaults[key]) params.delete(key)
      else params.set(key, String(value))
    }
    // เปลี่ยนตัวกรองแล้วต้องกลับไปหน้าแรกเสมอ ไม่งั้นจะค้างอยู่หน้าที่ไม่มีข้อมูล
    if (options?.resetPage !== false && !('page' in patch)) params.delete('page')

    const query = params.toString()
    latestQueryRef.current = query
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, router, searchParams])

  /** ล้างตัวกรองทั้งหมดในครั้งเดียว โดยเลือกเก็บพารามิเตอร์ที่เป็นแค่มุมมองได้ */
  const clearFilters = useCallback((preserveKeys: readonly string[] = []) => {
    const currentParams = new URLSearchParams(latestQueryRef.current)
    const params = new URLSearchParams()
    for (const key of preserveKeys) {
      const value = currentParams.get(key)
      if (value) params.set(key, value)
    }

    const query = params.toString()
    latestQueryRef.current = query
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  return { filters, setFilters, clearFilters }
}

/**
 * ช่องค้นหาที่หน่วงก่อนยิง เพื่อไม่ให้พิมพ์ทีละตัวอักษรแล้วยิง request ทุกครั้ง
 *
 * ตาม pattern ใน CLAUDE.md: หน่วง 350ms ตอนพิมพ์ แต่ล้างค่าให้มีผลทันที (0ms)
 * เพื่อให้กดล้างแล้วรายการเต็มกลับมาโดยไม่ต้องรอ
 */
export function useDebouncedSearch(initial: string, onCommit: (value: string) => void) {
  const [text, setText] = useState(initial)
  const onCommitRef = useRef(onCommit)
  const lastInitialRef = useRef(initial)

  useEffect(() => { onCommitRef.current = onCommit }, [onCommit])

  useEffect(() => {
    // ค่าจาก URL เปลี่ยนจากทางอื่น (กดย้อนกลับ, กดลิงก์ KPI หรือกดล้างทั้งหมด)
    // ต้อง sync ช่องค้นหาก่อน และห้ามนำค่าค้างเดิมกลับไปเขียน URL ซ้ำ
    if (lastInitialRef.current !== initial) {
      lastInitialRef.current = initial
      setText(initial)
      return
    }
    if (text === initial) return
    const timer = setTimeout(() => onCommitRef.current(text), text ? 350 : 0)
    return () => clearTimeout(timer)
  }, [initial, text])

  return [text, setText] as const
}
