import { create } from 'zustand'

type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  effectiveTheme: 'light' | 'dark'
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

// Get system theme preference
const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Get initial theme from localStorage or default to LIGHT (not system)
// This ensures new users always get light mode first
const getInitialTheme = (): { theme: Theme; effectiveTheme: 'light' | 'dark' } => {
  if (typeof window === 'undefined') return { theme: 'light', effectiveTheme: 'light' }

  const saved = localStorage.getItem('theme') as Theme | null
  const theme: Theme = saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'light'

  const effectiveTheme: 'light' | 'dark' = theme === 'system' ? getSystemTheme() : theme

  return { theme, effectiveTheme }
}

// Initialize theme immediately
const { theme: initialTheme, effectiveTheme: initialEffectiveTheme } = getInitialTheme()
if (typeof window !== 'undefined') {
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(initialEffectiveTheme)
  document.documentElement.setAttribute('data-theme', initialEffectiveTheme)

  // Add transition class after a small delay for smooth initial load
  setTimeout(() => {
    document.documentElement.classList.add('theme-transition-enabled')
  }, 100)
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleSystemThemeChange = (e: MediaQueryListEvent | MediaQueryList) => {
    const storedTheme = localStorage.getItem('theme') as Theme
    // Only apply system theme changes if user explicitly set 'system' mode
    if (storedTheme === 'system') {
      const newEffectiveTheme = e.matches ? 'dark' : 'light'
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(newEffectiveTheme)
      document.documentElement.setAttribute('data-theme', newEffectiveTheme)
    }
  }

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleSystemThemeChange)
  } else {
    // Older browsers
    mediaQuery.addListener(handleSystemThemeChange)
  }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: initialTheme,
  effectiveTheme: initialEffectiveTheme,

  setTheme: (newTheme: Theme) => {
    const effectiveTheme: 'light' | 'dark' = newTheme === 'system' ? getSystemTheme() : newTheme

    set({ theme: newTheme, effectiveTheme })

    if (typeof window !== 'undefined') {
      localStorage.setItem('theme', newTheme)
      // Apply theme to document with smooth transition
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(effectiveTheme)
      document.documentElement.setAttribute('data-theme', effectiveTheme)
    }
  },

  toggleTheme: () => {
    const { effectiveTheme: currentEffective } = get()
    const newEffective: 'light' | 'dark' = currentEffective === 'light' ? 'dark' : 'light'

    set(() => {
      const newTheme: Theme = newEffective
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', newTheme)
        document.documentElement.classList.remove('light', 'dark')
        document.documentElement.classList.add(newEffective)
        document.documentElement.setAttribute('data-theme', newEffective)
      }
      return { theme: newTheme, effectiveTheme: newEffective }
    })
  },
}))
