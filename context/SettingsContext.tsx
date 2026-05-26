'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { SETTINGS_DEFAULTS, type SystemSettings } from '@/lib/settings'
export { SETTINGS_DEFAULTS, type SystemSettings } from '@/lib/settings'

const STORAGE_KEY = 'lab_system_settings'

interface SettingsContextValue {
  settings: SystemSettings
  loading: boolean
  saveSettings: (s: SystemSettings) => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: SETTINGS_DEFAULTS,
  loading: false,
  saveSettings: async () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(SETTINGS_DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let ignore = false
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings', { cache: 'no-store' })
        const data = await res.json()
        if (!ignore && res.ok) {
          const next = { ...SETTINGS_DEFAULTS, ...data }
          setSettings(next)
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
      } catch {
        try {
          const raw = localStorage.getItem(STORAGE_KEY)
          if (!ignore && raw) setSettings({ ...SETTINGS_DEFAULTS, ...JSON.parse(raw) })
        } catch {}
      } finally {
        if (!ignore) setLoading(false)
      }
    }
    loadSettings()
    return () => { ignore = true }
  }, [])

  async function saveSettings(s: SystemSettings) {
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(s),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Unable to save settings')

    const next = { ...SETTINGS_DEFAULTS, ...data }
    setSettings(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
