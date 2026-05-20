'use client'

import { LangProvider } from '@/context/LangContext'
import { SettingsProvider } from '@/context/SettingsContext'
import { ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SettingsProvider>
      <LangProvider>{children}</LangProvider>
    </SettingsProvider>
  )
}
