'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export interface SystemSettings {
  siteName:   string
  systemCode: string
  orgName:    string
  standards:  string
  version:    string
}

export const SETTINGS_DEFAULTS: SystemSettings = {
  siteName:   'Lab Management Portal',
  systemCode: 'MN-LAB-01',
  orgName:    'กลุ่มงานเทคนิคการแพทย์ โรงพยาบาลชลบุรี',
  standards:  'ISO 15189 · ISO 15190',
  version:    'v1.0.0',
}

const STORAGE_KEY = 'lab_system_settings'

interface SettingsContextValue {
  settings: SystemSettings
  saveSettings: (s: SystemSettings) => void
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: SETTINGS_DEFAULTS,
  saveSettings: () => {},
})

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SystemSettings>(SETTINGS_DEFAULTS)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setSettings({ ...SETTINGS_DEFAULTS, ...JSON.parse(raw) })
    } catch {}
  }, [])

  function saveSettings(s: SystemSettings) {
    setSettings(s)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  }

  return (
    <SettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  return useContext(SettingsContext)
}
