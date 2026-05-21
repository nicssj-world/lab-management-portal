'use client'

import { createContext, useContext } from 'react'
import type { Permissions, PermLevel } from '@/lib/permissions'

const PermissionContext = createContext<Permissions>({})

export function PermissionProvider({ permissions, children }: {
  permissions: Permissions
  children: React.ReactNode
}) {
  return (
    <PermissionContext.Provider value={permissions}>
      {children}
    </PermissionContext.Provider>
  )
}

export function usePermission(resource: string) {
  const perms = useContext(PermissionContext)
  const level: PermLevel = (perms[resource] as PermLevel) ?? 'none'
  return { level, canView: level !== 'none', canEdit: level === 'edit' }
}
