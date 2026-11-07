import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Capacitor, SystemBars, SystemBarsStyle } from '@capacitor/core'

export type Theme = 'light' | 'dark' | 'system'

interface SettingsState {
  theme: Theme
  hideValues: boolean
  setTheme: (t: Theme) => void
  toggleHideValues: () => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: 'system',
      hideValues: false,
      setTheme: (theme) => set({ theme }),
      toggleHideValues: () => set((s) => ({ hideValues: !s.hideValues })),
    }),
    { name: 'noteapp-settings', version: 1 },
  ),
)

export function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
  document
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((m) => m.setAttribute('content', dark ? '#0b0f17' : '#f8fafc'))
  // no app Android, ajusta a cor dos ícones da barra de status/navegação
  if (Capacitor.isNativePlatform()) {
    SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {})
  }
}
