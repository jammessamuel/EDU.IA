import { computed, ref } from 'vue'

type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'eduia_theme'
const theme = ref<ThemeMode>('light')
let initialized = false

function preferredTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(nextTheme: ThemeMode, persist = true) {
  theme.value = nextTheme
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = nextTheme
    document.documentElement.style.colorScheme = nextTheme
  }
  if (persist && typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, nextTheme)
  }
}

export function initTheme() {
  if (initialized) return
  initialized = true
  applyTheme(preferredTheme(), false)
}

export function useTheme() {
  initTheme()

  const isDark = computed(() => theme.value === 'dark')
  const themeLabel = computed(() => (isDark.value ? 'Modo claro' : 'Modo escuro'))

  function setTheme(nextTheme: ThemeMode) {
    applyTheme(nextTheme)
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark')
  }

  return {
    theme,
    isDark,
    themeLabel,
    setTheme,
    toggleTheme,
  }
}
