import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Get initial theme from localStorage or default to light
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('theme') as Theme | null
  if (saved === 'light' || saved === 'dark') return saved

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }

  return 'light'
}

// Initialize theme immediately
const initialTheme = getInitialTheme()
if (typeof window !== 'undefined') {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(initialTheme)
  document.documentElement.setAttribute('data-theme', initialTheme)
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: initialTheme,

  setTheme: (theme: Theme) => {
    set({ theme })
    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', theme)
      // Apply theme to document
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(theme)
      document.documentElement.setAttribute('data-theme', theme)
    }
  },

  toggleTheme: () => {
    set((state) => {
      const newTheme: Theme = state.theme === 'light' ? 'dark' : 'light'
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme)
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(newTheme)
        document.documentElement.setAttribute('data-theme', newTheme)
      }
      return { theme: newTheme }
    })
  },
}))
