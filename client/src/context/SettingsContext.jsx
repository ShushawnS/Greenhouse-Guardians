import { createContext, useContext, useState } from 'react'

const DEFAULTS = {
  confidenceThreshold: 0.50,
  autoRefresh: false,
  tomatoTrack: 'remote',
  flowerTrack: 'remote',
}

const SettingsContext = createContext(null)

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('gg_settings')
      return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS
    } catch {
      return DEFAULTS
    }
  })

  function updateSettings(updates) {
    setSettings(prev => {
      const next = { ...prev, ...updates }
      localStorage.setItem('gg_settings', JSON.stringify(next))
      return next
    })
  }

  function resetSettings() {
    localStorage.setItem('gg_settings', JSON.stringify(DEFAULTS))
    setSettings(DEFAULTS)
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings, DEFAULTS }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider')
  return ctx
}
