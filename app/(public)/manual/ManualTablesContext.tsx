'use client'
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type SectionTables = Record<string, unknown[]>
export type DbTables = Record<string, SectionTables>

interface Ctx {
  tables: DbTables
  canEdit: boolean
  setTableRows: (sectionId: string, tableId: string, rows: unknown[]) => void
}

const ManualTablesCtx = createContext<Ctx>({ tables: {}, canEdit: false, setTableRows: () => {} })

export function ManualTablesProvider({
  initial, canEdit, children,
}: { initial: DbTables; canEdit: boolean; children: ReactNode }) {
  const [tables, setTables] = useState<DbTables>(initial)
  const setTableRows = useCallback((sectionId: string, tableId: string, rows: unknown[]) => {
    setTables(prev => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? {}), [tableId]: rows },
    }))
  }, [])
  return (
    <ManualTablesCtx.Provider value={{ tables, canEdit, setTableRows }}>
      {children}
    </ManualTablesCtx.Provider>
  )
}

export function useManualTable<T>(tableId: string, sectionId: string, defaultRows: T[]) {
  const { tables, canEdit, setTableRows } = useContext(ManualTablesCtx)
  const dbRows = tables[sectionId]?.[tableId]
  const rows = (Array.isArray(dbRows) && dbRows.length > 0 ? (dbRows as T[]) : defaultRows)
  const setRows = useCallback((next: T[]) => setTableRows(sectionId, tableId, next as unknown[]), [sectionId, tableId, setTableRows])
  return { rows, canEdit, setRows }
}
