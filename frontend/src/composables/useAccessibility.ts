import { computed, readonly, ref } from 'vue'
import { accessibilityApi } from '@/api/accessibility'
import type { AccessibilityProfile, ColorBlindMode } from '@/types'

const STORAGE_KEY = 'eduia_accessibility'

export const DEFAULT_ACCESSIBILITY: AccessibilityProfile = {
  screenReader: false,
  highContrast: false,
  colorBlindMode: 'none',
  reduceMotion: false,
  simpleLanguage: false,
  fontScale: 1,
}

const profile = ref<AccessibilityProfile>(readLocal())
const systemReduceMotion = ref(false)
const systemHighContrast = ref(false)
const initialized = ref(false)
const loading = ref(false)

function readLocal(): AccessibilityProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_ACCESSIBILITY }
    return normalize(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_ACCESSIBILITY }
  }
}

function normalize(input: Partial<AccessibilityProfile>): AccessibilityProfile {
  const mode = ['none', 'protanopia', 'deuteranopia', 'tritanopia'].includes(input.colorBlindMode ?? '')
    ? (input.colorBlindMode as ColorBlindMode)
    : 'none'

  return {
    screenReader: Boolean(input.screenReader),
    highContrast: Boolean(input.highContrast),
    colorBlindMode: mode,
    reduceMotion: Boolean(input.reduceMotion),
    simpleLanguage: Boolean(input.simpleLanguage),
    fontScale: Math.min(1.35, Math.max(0.9, Number(input.fontScale || 1))),
  }
}

function persistLocal(next: AccessibilityProfile) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
}

function applyProfile() {
  const root = document.documentElement
  const effectiveHighContrast = profile.value.highContrast || systemHighContrast.value
  const effectiveReduceMotion = profile.value.reduceMotion || systemReduceMotion.value

  root.dataset.highContrast = String(effectiveHighContrast)
  root.dataset.reduceMotion = String(effectiveReduceMotion)
  root.dataset.screenReader = String(profile.value.screenReader)
  root.dataset.simpleLanguage = String(profile.value.simpleLanguage)
  root.dataset.colorBlindMode = profile.value.colorBlindMode
  root.style.setProperty('--a11y-font-scale', profile.value.fontScale.toFixed(2))
}

function listenToSystemPreferences() {
  const reduceQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const contrastQuery = window.matchMedia('(prefers-contrast: more)')
  systemReduceMotion.value = reduceQuery.matches
  systemHighContrast.value = contrastQuery.matches

  reduceQuery.addEventListener?.('change', (event) => {
    systemReduceMotion.value = event.matches
    applyProfile()
  })
  contrastQuery.addEventListener?.('change', (event) => {
    systemHighContrast.value = event.matches
    applyProfile()
  })
}

export function initAccessibility() {
  if (initialized.value || typeof window === 'undefined') return
  initialized.value = true
  listenToSystemPreferences()
  applyProfile()
}

export function useAccessibility() {
  async function syncFromServer() {
    if (!localStorage.getItem('eduia_token')) {
      applyProfile()
      return profile.value
    }

    loading.value = true
    try {
      const remote = normalize(await accessibilityApi.get())
      profile.value = remote
      persistLocal(remote)
      applyProfile()
      return remote
    } catch {
      applyProfile()
      return profile.value
    } finally {
      loading.value = false
    }
  }

  async function updateProfile(input: Partial<AccessibilityProfile>) {
    const next = normalize({ ...profile.value, ...input })
    profile.value = next
    persistLocal(next)
    applyProfile()

    if (!localStorage.getItem('eduia_token')) return next

    loading.value = true
    try {
      const remote = normalize(await accessibilityApi.update(next))
      profile.value = remote
      persistLocal(remote)
      applyProfile()
      return remote
    } finally {
      loading.value = false
    }
  }

  function resetProfile() {
    return updateProfile({ ...DEFAULT_ACCESSIBILITY })
  }

  return {
    profile: readonly(profile),
    loading: readonly(loading),
    effectiveReduceMotion: computed(() => profile.value.reduceMotion || systemReduceMotion.value),
    effectiveHighContrast: computed(() => profile.value.highContrast || systemHighContrast.value),
    syncFromServer,
    updateProfile,
    resetProfile,
  }
}
