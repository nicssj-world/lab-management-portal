'use client'

import { createContext, useContext, useState } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  mobileOpen: boolean
  toggle: () => void
  toggleMobile: () => void
  closeMobile: () => void
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  mobileOpen: false,
  toggle: () => {},
  toggleMobile: () => {},
  closeMobile: () => {},
})

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  return (
    <SidebarContext.Provider
      value={{
        collapsed,
        mobileOpen,
        toggle:       () => setCollapsed(c => !c),
        toggleMobile: () => setMobileOpen(open => !open),
        closeMobile:  () => setMobileOpen(false),
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
